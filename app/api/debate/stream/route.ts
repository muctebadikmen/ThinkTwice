import { NextRequest } from 'next/server';
import { debateStore } from '../route';

export const dynamic = 'force-dynamic';

/**
 * Grace window before a disconnected client's debate is aborted. EventSource
 * auto-reconnects on transient network blips, which also triggers the stream's
 * cancel(). Deferring the abort lets a genuine reconnect cancel it, so only a
 * truly abandoned debate gets killed.
 */
const STREAM_ABORT_GRACE_MS = 10 * 1000;

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return new Response('Missing debate id', { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Wait up to 5s for the debate job to be registered
      let waited = 0;
      while (!debateStore.has(id) && waited < 5000) {
        await sleep(100);
        waited += 100;
      }

      const entry = debateStore.get(id);
      if (!entry) {
        controller.enqueue(encoder.encode('id: -1\ndata: {"type":"error","error":"Debate not found"}\n\n'));
        controller.close();
        return;
      }

      // A consumer (re)connected — cancel any pending abort from a prior disconnect.
      if (entry.abortTimer) {
        clearTimeout(entry.abortTimer);
        entry.abortTimer = null;
      }

      // Resume support: browsers auto-reconnect and send Last-Event-ID (the index
      // of the last event they received). Resume after it so events are never
      // resent — otherwise a reconnect would duplicate rounds and streamed text.
      const lastEventId = req.headers.get('last-event-id');
      const parsedId = lastEventId ? parseInt(lastEventId, 10) : NaN;
      let cursor = Number.isFinite(parsedId)
        ? Math.min(Math.max(parsedId + 1, 0), entry.events.length)
        : 0;

      while (true) {
        // Drain any buffered events
        while (cursor < entry.events.length) {
          controller.enqueue(encoder.encode('id: ' + cursor + '\n' + entry.events[cursor]));
          cursor++;
        }

        // If debate is done and we've sent everything, close
        if (entry.done && cursor >= entry.events.length) {
          controller.enqueue(encoder.encode('id: ' + cursor + '\ndata: {"type":"done"}\n\n'));
          controller.close();
          return;
        }

        // Wait for next event (or done signal)
        await new Promise<void>((resolve) => {
          entry.resolve = resolve;
        });
      }
    },
    cancel() {
      // Client disconnected. Don't abort immediately — EventSource reconnects on
      // transient blips and fires cancel() too. Defer the abort; if a new consumer
      // connects within the grace window, start() clears this timer. Only a truly
      // abandoned debate is aborted, killing its in-flight model requests.
      const entry = debateStore.get(id);
      if (!entry || entry.done) return;
      if (entry.abortTimer) clearTimeout(entry.abortTimer);
      entry.abortTimer = setTimeout(() => {
        entry.abortController.abort();
        entry.abortTimer = null;
      }, STREAM_ABORT_GRACE_MS);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
