/**
 * ThinkTwice — model runner with dual backend support.
 *
 * Backend selection (checked in order):
 *   1. CLAUDE_CODE_OAUTH_TOKEN set  → Claude CLI (spawn)
 *   2. otherwise                     → OpenRouter API (HTTP fetch)
 *
 * Environment variables:
 *   OPENROUTER_API_KEY     — required for OpenRouter backend
 *   CLAUDE_CODE_OAUTH_TOKEN — required for Claude CLI backend
 */

import { spawn } from 'child_process';

// ── Config ──────────────────────────────────────────────────────────────────────

const BACKEND: 'claude' | 'openrouter' =
  process.env.CLAUDE_CODE_OAUTH_TOKEN ? 'claude' : 'openrouter';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1/chat/completions';
const CLAUDE_PROCESS_TIMEOUT_MS = 5 * 60 * 1000;
const OPENROUTER_TIMEOUT_MS = 5 * 60 * 1000;
const CLAUDE_DEFAULT_MAX_TURNS = 6;

// Models without built-in web search — auto-routed to SEARCH_MODEL on OpenRouter
const NON_SEARCH_MODEL_PREFIXES = ['deepseek/deepseek'];
const SEARCH_MODEL = 'perplexity/sonar';

// ── Model Aliases ───────────────────────────────────────────────────────────────

const OPENROUTER_ALIASES: Record<string, string> = {
  fable: 'perplexity/sonar-pro',
  opus: 'perplexity/sonar-pro',
  sonnet: 'perplexity/sonar',
  haiku: 'perplexity/sonar',
  'deepseek-chat': 'deepseek/deepseek-chat',
  'deepseek-r1': 'deepseek/deepseek-r1',
  'deepseek-v4-flash': 'deepseek/deepseek-v4-flash',
  'sonar-pro': 'perplexity/sonar-pro',
  'sonar': 'perplexity/sonar',
};

const CLAUDE_ALIASES: Record<string, string> = {
  fable: 'claude-fable-5',
  opus: 'claude-opus-4-8',
  sonnet: 'claude-sonnet-4-6',
  haiku: 'claude-haiku-4-5',
};

export function resolveModel(model: string): string {
  const key = model.trim().toLowerCase();
  const aliases = BACKEND === 'claude' ? CLAUDE_ALIASES : OPENROUTER_ALIASES;
  return aliases[key] ?? model;
}

// ── Error Class ─────────────────────────────────────────────────────────────────

export class ClaudeRunnerError extends Error {
  readonly apiErrorStatus?: number;
  readonly isAuthError: boolean;

  constructor(message: string, apiErrorStatus?: number, backend?: string) {
    const isAuth =
      apiErrorStatus === 401 ||
      apiErrorStatus === 403 ||
      /unauthorized|invalid.*api|forbidden|authenticat|invalid.*credential/i.test(message);

    const prefix = backend === 'claude'
      ? 'Claude CLI'
      : 'OpenRouter';

    super(
      isAuth
        ? `${prefix} authentication failed — ${backend === 'claude' ? '`claude` CLI is not logged in or its session has expired. Run `claude` to sign in (or `claude setup-token`)' : 'OPENROUTER_API_KEY is missing, invalid, or expired. Set it in .env.local and restart.'}`
        : `${prefix} API error${apiErrorStatus ? ` (HTTP ${apiErrorStatus})` : ''}: ${message}`
    );
    this.name = 'ClaudeRunnerError';
    this.apiErrorStatus = apiErrorStatus;
    this.isAuthError = isAuth;
  }
}

// ── Main Dispatch ───────────────────────────────────────────────────────────────

export function runClaude(
  prompt: string,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
  model: string = 'sonnet',
  maxTurns: number = CLAUDE_DEFAULT_MAX_TURNS,
): Promise<string> {
  return BACKEND === 'claude'
    ? runClaudeCLI(prompt, onChunk, signal, model, maxTurns)
    : runClaudeOpenRouter(prompt, onChunk, signal, model, maxTurns);
}

// ════════════════════════════════════════════════════════════════════════════════
// OPENROUTER BACKEND
// ════════════════════════════════════════════════════════════════════════════════

async function runClaudeOpenRouter(
  prompt: string,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
  model: string = 'sonnet',
  _maxTurns?: number,
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new ClaudeRunnerError(
      'OPENROUTER_API_KEY is not set. Add it to .env.local and restart.',
      401, 'openrouter'
    );
  }

  const resolvedModel = resolveModel(model);

  // ponytail: auto-route to search-capable model when prompt asks for web data
  const needsSearch = /\bWebSearch\b|\bWebFetch\b/i.test(prompt);
  const actualModel = needsSearch && NON_SEARCH_MODEL_PREFIXES.some(p => resolvedModel.startsWith(p))
    ? SEARCH_MODEL
    : resolvedModel;

  const body = JSON.stringify({
    model: actualModel,
    messages: [{ role: 'user', content: prompt }],
    stream: true,
    max_tokens: 8192,
  });

  const timeoutController = new AbortController();
  const timeoutHandle = setTimeout(() => timeoutController.abort(), OPENROUTER_TIMEOUT_MS);
  const combinedSignal = signal ? anySignal([signal, timeoutController.signal]) : timeoutController.signal;

  let fullText = '';

  try {
    const res = await fetch(OPENROUTER_BASE, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        'X-Title': 'ThinkTwice',
      },
      body,
      signal: combinedSignal,
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      throw new ClaudeRunnerError(errorText || res.statusText, res.status, 'openrouter');
    }

    const reader = res.body?.getReader();
    if (!reader) {
      throw new ClaudeRunnerError('Response body is empty — no stream available.', undefined, 'openrouter');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') break;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) { fullText += delta; onChunk(delta); }
        } catch { /* skip malformed */ }
      }
    }

    return fullText;
  } catch (err) {
    if (err instanceof ClaudeRunnerError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ClaudeRunnerError(
        signal?.aborted ? 'Request was cancelled.' : `Model did not respond within ${OPENROUTER_TIMEOUT_MS / 1000}s.`,
        undefined, 'openrouter'
      );
    }
    throw new ClaudeRunnerError(err instanceof Error ? err.message : String(err), undefined, 'openrouter');
  } finally {
    clearTimeout(timeoutHandle);
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// CLAUDE CLI BACKEND
// ════════════════════════════════════════════════════════════════════════════════

function extractResultText(result: unknown): string {
  if (typeof result === 'string') return result;
  if (result && typeof result === 'object') {
    const r = result as Record<string, unknown>;
    if (typeof r.text === 'string') return r.text;
    if (Array.isArray(r.content)) {
      return r.content
        .filter((c: Record<string, unknown>) => c.type === 'text' && typeof c.text === 'string')
        .map((c: Record<string, unknown>) => c.text)
        .join('');
    }
  }
  return '';
}

function runClaudeCLI(
  prompt: string,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
  model: string = 'sonnet',
  maxTurns: number = CLAUDE_DEFAULT_MAX_TURNS,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('Aborted'));

    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env.CLAUDECODE;

    const proc = spawn('claude', [
      '-p', prompt,
      '--output-format', 'stream-json',
      '--verbose',
      '--allowedTools', 'WebSearch,WebFetch',
      '--model', resolveModel(model),
      '--max-turns', String(maxTurns),
    ], { env, stdio: ['ignore', 'pipe', 'pipe'] });

    let fullText = '';
    let buffer = '';
    let resolved = false;
    let stderrOutput = '';

    const timeoutHandle = setTimeout(() => {
      if (!resolved) {
        console.error(`[model-runner] CLI process timed out after ${CLAUDE_PROCESS_TIMEOUT_MS / 1000}s`);
        cleanup();
        resolved = true;
        resolve(fullText || '[Response timed out — the advocate was unable to complete research in time.]');
      }
    }, CLAUDE_PROCESS_TIMEOUT_MS);

    const cleanup = () => {
      clearTimeout(timeoutHandle);
      if (!proc.killed) proc.kill();
    };

    signal?.addEventListener('abort', () => {
      cleanup();
      if (!resolved) { resolved = true; reject(new Error('Aborted')); }
    });

    proc.stdout.on('data', (raw: Buffer) => {
      buffer += raw.toString('utf8');
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        let event: Record<string, unknown>;
        try { event = JSON.parse(trimmed); } catch { continue; }

        if (event.type === 'stream_event') {
          const se = event.event as Record<string, unknown> | undefined;
          if (!se) continue;
          if (se.type === 'content_block_delta') {
            const delta = se.delta as Record<string, unknown> | undefined;
            if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
              fullText += delta.text;
              onChunk(delta.text);
            }
          }
        }

        if (event.type === 'result') {
          const apiErrorStatus = typeof event.api_error_status === 'number' ? event.api_error_status : undefined;
          if (event.is_error === true || apiErrorStatus !== undefined) {
            const detail = extractResultText(event.result) || 'Claude CLI returned an error.';
            cleanup();
            if (!resolved) { resolved = true; reject(new ClaudeRunnerError(detail, apiErrorStatus, 'claude')); }
            return;
          }

          const resultText = extractResultText(event.result);
          if (resultText && resultText.length > fullText.length) {
            const newContent = resultText.slice(fullText.length);
            if (newContent) onChunk(newContent);
            fullText = resultText;
          } else if (!fullText && resultText) {
            fullText = resultText;
            onChunk(resultText);
          }
          if (!resolved) { resolved = true; clearTimeout(timeoutHandle); resolve(fullText); }
        }
      }
    });

    proc.stderr.on('data', (chunk: Buffer) => { stderrOutput += chunk.toString('utf8'); });
    proc.on('error', (err) => {
      cleanup();
      if (!resolved) { resolved = true; reject(new Error(`Failed to spawn claude: ${err.message}`)); }
    });
    proc.on('close', (code) => {
      clearTimeout(timeoutHandle);
      if (!resolved) {
        resolved = true;
        if (fullText) {
          resolve(fullText);
        } else if (code !== 0) {
          resolve('[The advocate encountered an error and was unable to respond this round.]');
        } else {
          resolve('[The advocate was unable to produce a response this round.]');
        }
      }
    });
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────────

function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const sig of signals) {
    if (sig.aborted) { controller.abort(sig.reason); return controller.signal; }
    sig.addEventListener('abort', () => controller.abort(sig.reason), { once: true });
  }
  return controller.signal;
}
