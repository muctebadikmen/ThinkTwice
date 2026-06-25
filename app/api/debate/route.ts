import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import type { WaitForUserInputFn } from '@/lib/orchestrator';
import type { ExpertPerspective } from '@/types/debate';

// In-memory store for active debate jobs (keyed by debate ID)
// Each entry holds a queue of SSE events and completion state
export const debateStore = new Map<
  string,
  {
    events: string[];          // buffered SSE lines
    done: boolean;
    error: string | null;
    resolve: (() => void) | null;  // notifies waiting stream consumers
    userInputResolve: ((input: string) => void) | null;  // resolves user input promise
    waitingForUserInput: boolean;  // flag for input endpoint
    abortController: AbortController;  // cancels in-flight claude subprocesses
    abortTimer: ReturnType<typeof setTimeout> | null;  // deferred abort after client disconnect
  }
>();

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { options, context, language, model, experts, continueFromDebateId, userChallenge, autoMode } = body as {
    options: string[];
    context?: string;
    language?: string;
    model?: string;
    experts?: ExpertPerspective[];
    continueFromDebateId?: string;
    userChallenge?: string;
    autoMode?: boolean;
  };

  if (!options || options.length < 2) {
    return NextResponse.json({ error: 'At least 2 options required' }, { status: 400 });
  }

  const id = randomUUID();

  // Initialise the store entry
  debateStore.set(id, {
    events: [],
    done: false,
    error: null,
    resolve: null,
    userInputResolve: null,
    waitingForUserInput: false,
    abortController: new AbortController(),
    abortTimer: null,
  });

  // Run debate asynchronously — don't await, just kick it off
  void startDebateJob(
    id,
    options,
    context ?? '',
    language ?? 'English',
    model ?? 'sonnet',
    experts ?? null,
    continueFromDebateId ?? null,
    userChallenge ?? null,
    autoMode ?? false
  );

  return NextResponse.json({ id });
}

async function startDebateJob(
  id: string,
  options: string[],
  context: string,
  language: string,
  model: string,
  experts: ExpertPerspective[] | null,
  continueFromDebateId: string | null,
  userChallenge: string | null,
  autoMode: boolean
) {
  const { runDebate } = await import('@/lib/orchestrator');

  const emit = (event: unknown) => {
    const entry = debateStore.get(id);
    if (!entry) return;
    entry.events.push('data: ' + JSON.stringify(event) + '\n\n');
    entry.resolve?.();
    entry.resolve = null;
  };

  // Callback that the orchestrator calls when it wants user input.
  // Creates a Promise whose resolver is stored in debateStore,
  // so the POST /api/debate/input endpoint can resolve it.
  const waitForUserInput: WaitForUserInputFn = (question: string) => {
    void question; // question is for context; the emit happens in orchestrator
    return new Promise<string>((resolve) => {
      const entry = debateStore.get(id);
      if (!entry) {
        resolve('');
        return;
      }

      // Auto-timeout after 15 minutes
      const timeout = setTimeout(() => {
        if (entry.waitingForUserInput) {
          entry.userInputResolve = null;
          entry.waitingForUserInput = false;
          resolve('No response provided — please continue with available information.');
        }
      }, 15 * 60 * 1000);

      entry.userInputResolve = (input: string) => {
        clearTimeout(timeout);
        resolve(input);
      };
      entry.waitingForUserInput = true;
    });
  };

  // If continuing from a previous debate, fetch its rounds from the continuation store
  let previousRounds = null;
  if (continueFromDebateId) {
    const { continuationStore } = await import('@/lib/continuation-store');
    previousRounds = continuationStore.get(continueFromDebateId) ?? null;
  }

  const signal = debateStore.get(id)?.abortController.signal;

  try {
    await runDebate(
      options,
      context,
      emit,
      autoMode ? null : waitForUserInput,
      signal,
      language,
      model,
      experts,
      previousRounds,
      userChallenge,
      autoMode
    );
  } catch (err) {
    const entry = debateStore.get(id);
    if (entry) {
      const message = err instanceof Error ? err.message : String(err);
      entry.error = message;
      entry.events.push('data: ' + JSON.stringify({ type: 'error', error: message }) + '\n\n');
      entry.resolve?.();
      entry.resolve = null;
    }
  } finally {
    const entry = debateStore.get(id);
    if (entry) {
      entry.done = true;
      entry.resolve?.();
      entry.resolve = null;
    }
    // Clean up store after 30 minutes (extended to accommodate user input delays).
    // Abort first as a safety net in case any subprocess is somehow still alive.
    setTimeout(() => {
      const e = debateStore.get(id);
      if (e?.abortTimer) clearTimeout(e.abortTimer);
      e?.abortController.abort();
      debateStore.delete(id);
    }, 30 * 60 * 1000);
  }
}
