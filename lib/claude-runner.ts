import { spawn } from 'child_process';

/**
 * Maximum time (in ms) for a single Claude subprocess to run.
 * Prevents processes from hanging forever on large prompts.
 * 5 minutes is generous — most rounds finish in 1-3 min.
 */
const PROCESS_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Default number of agentic turns allowed per Claude subprocess.
 * A turn is one model response; tool use (WebSearch/WebFetch) consumes turns.
 * With only 3 turns, an advocate that searches the web can run out of turns
 * before writing its actual argument — producing empty/planning-only output.
 * 6 gives room to search, read results, and still write a substantive response.
 */
const DEFAULT_MAX_TURNS = 6;

/**
 * Maps the UI/model-selector aliases to concrete, current Claude model IDs.
 * Pinning real IDs (instead of bare aliases like "sonnet") removes ambiguity
 * about which model version actually runs. If a full model ID is passed in,
 * it is forwarded unchanged so callers can override.
 */
const MODEL_ALIASES: Record<string, string> = {
  fable: 'claude-fable-5',
  opus: 'claude-opus-4-8',
  sonnet: 'claude-sonnet-4-6',
  haiku: 'claude-haiku-4-5',
};

export function resolveModel(model: string): string {
  const key = model.trim().toLowerCase();
  return MODEL_ALIASES[key] ?? model;
}

/**
 * Error thrown when the `claude` CLI reports an API/auth/usage failure.
 *
 * The CLI signals these via a `result` event with `is_error: true` (often with
 * an `api_error_status`). Previously we passed the error *text* downstream as if
 * it were a real model response — so parse-prompt would try to `JSON.parse`
 * "Failed to authenticate…" (cryptic SyntaxError) and advocates would literally
 * "argue" the error string. Surfacing a typed error lets callers show the real
 * cause (e.g. "log in to the claude CLI") instead of garbage.
 */
export class ClaudeRunnerError extends Error {
  readonly apiErrorStatus?: number;
  readonly isAuthError: boolean;

  constructor(detail: string, apiErrorStatus?: number) {
    const isAuth =
      apiErrorStatus === 401 ||
      apiErrorStatus === 403 ||
      /authenticat|invalid.*credential/i.test(detail);

    super(
      isAuth
        ? 'Claude authentication failed — the `claude` CLI is not logged in or its session has expired. Open a terminal, run `claude` to sign in (or `claude setup-token`), then try again.'
        : `Claude CLI error${apiErrorStatus ? ` (HTTP ${apiErrorStatus})` : ''}: ${detail}`
    );

    this.name = 'ClaudeRunnerError';
    this.apiErrorStatus = apiErrorStatus;
    this.isAuthError = isAuth;
  }
}

/**
 * Extract text content from a result event's result field.
 * Handles both string and object formats.
 */
function extractResultText(result: unknown): string {
  if (typeof result === 'string') return result;
  if (result && typeof result === 'object') {
    const r = result as Record<string, unknown>;
    // Handle { text: "..." } format
    if (typeof r.text === 'string') return r.text;
    // Handle { content: [{ type: "text", text: "..." }] } format
    if (Array.isArray(r.content)) {
      return r.content
        .filter((c: Record<string, unknown>) => c.type === 'text' && typeof c.text === 'string')
        .map((c: Record<string, unknown>) => c.text)
        .join('');
    }
  }
  return '';
}

/**
 * Runs a claude -p subprocess and streams text chunks via onChunk callback.
 * Returns the full accumulated response when complete.
 *
 * Key: we delete CLAUDECODE from env so nested claude instances are allowed.
 *
 * IMPORTANT: We do NOT use --include-partial-messages because it causes
 * intermediate turn text (e.g., "I'll research...") to be streamed and can
 * trigger premature resolution before tool-use turns complete. Without it,
 * only the FINAL assistant message is streamed — which is the actual response.
 */
export function runClaude(
  prompt: string,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
  model: string = 'sonnet',
  maxTurns: number = DEFAULT_MAX_TURNS
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new Error('Aborted'));
    }

    // Remove CLAUDECODE env var — required to allow nested claude sessions
    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env.CLAUDECODE;

    const proc = spawn(
      'claude',
      [
        '-p', prompt,
        '--output-format', 'stream-json',
        '--verbose',
        '--allowedTools', 'WebSearch,WebFetch',
        '--model', resolveModel(model),
        '--max-turns', String(maxTurns),
      ],
      { env, stdio: ['ignore', 'pipe', 'pipe'] }
    );

    let fullText = '';
    let buffer = '';
    let resolved = false;
    let stderrOutput = '';

    // Hard timeout — kill process if it runs too long
    const timeoutHandle = setTimeout(() => {
      if (!resolved) {
        console.error(`[claude-runner] Process timed out after ${PROCESS_TIMEOUT_MS / 1000}s, killing...`);
        cleanup();
        // Still resolve with whatever text we have rather than crashing the debate
        resolved = true;
        if (fullText) {
          resolve(fullText);
        } else {
          resolve('[Response timed out — the advocate was unable to complete research in time.]');
        }
      }
    }, PROCESS_TIMEOUT_MS);

    const cleanup = () => {
      clearTimeout(timeoutHandle);
      if (!proc.killed) proc.kill();
    };

    signal?.addEventListener('abort', () => {
      cleanup();
      if (!resolved) {
        resolved = true;
        reject(new Error('Aborted'));
      }
    });

    proc.stdout.on('data', (raw: Buffer) => {
      buffer += raw.toString('utf8');

      // Parse newline-delimited JSON events
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        let event: Record<string, unknown>;
        try {
          event = JSON.parse(trimmed);
        } catch {
          continue;
        }

        if (event.type === 'stream_event') {
          const se = event.event as Record<string, unknown> | undefined;
          if (!se) continue;

          // text delta — the core streaming output
          if (se.type === 'content_block_delta') {
            const delta = se.delta as Record<string, unknown> | undefined;
            if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
              fullText += delta.text;
              onChunk(delta.text);
            }
          }
        }

        // result event signals completion — may contain the final text
        if (event.type === 'result') {
          // First, detect API/auth/usage failures. The CLI exits 0 but sets
          // is_error=true (and usually api_error_status) on the result event.
          // Reject loudly rather than passing the error message through as a
          // valid response.
          const apiErrorStatus =
            typeof event.api_error_status === 'number'
              ? event.api_error_status
              : undefined;
          if (event.is_error === true || apiErrorStatus !== undefined) {
            const detail =
              extractResultText(event.result) || 'Claude CLI returned an error.';
            cleanup();
            if (!resolved) {
              resolved = true;
              reject(new ClaudeRunnerError(detail, apiErrorStatus));
            }
            return;
          }

          const resultText = extractResultText(event.result);

          // Use the result text if it's more complete than what we streamed
          if (resultText && resultText.length > fullText.length) {
            const newContent = resultText.slice(fullText.length);
            if (newContent) onChunk(newContent);
            fullText = resultText;
          } else if (!fullText && resultText) {
            fullText = resultText;
            onChunk(resultText);
          }

          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutHandle);
            resolve(fullText);
          }
        }
      }
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      // Capture stderr for debugging but don't surface to user
      stderrOutput += chunk.toString('utf8');
    });

    proc.on('error', (err) => {
      cleanup();
      if (!resolved) {
        resolved = true;
        reject(new Error(`Failed to spawn claude: ${err.message}`));
      }
    });

    proc.on('close', (code) => {
      clearTimeout(timeoutHandle);
      if (!resolved) {
        resolved = true;
        if (fullText) {
          // Process ended without a result event but we have text
          resolve(fullText);
        } else if (code !== 0) {
          console.error(`[claude-runner] Process exited with code ${code}. stderr: ${stderrOutput.slice(0, 500)}`);
          // Resolve with an error message rather than rejecting — keeps the debate alive
          resolve('[The advocate encountered an error and was unable to respond this round.]');
        } else {
          // Exit 0 but no text — unusual but handle gracefully
          console.error(`[claude-runner] Process exited cleanly but produced no text. stderr: ${stderrOutput.slice(0, 500)}`);
          resolve('[The advocate was unable to produce a response this round.]');
        }
      }
    });
  });
}
