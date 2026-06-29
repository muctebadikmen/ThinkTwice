import { NextResponse } from 'next/server';

// ── Claude CLI models ──────────────────────────────────────────────────────────
const CLAUDE_MODELS = [
  { id: 'sonnet', name: 'Claude Sonnet 4.6' },
  { id: 'opus',   name: 'Claude Opus 4.8' },
  { id: 'haiku',  name: 'Claude Haiku 4.5' },
];

// ── OpenRouter curated list (reasoning & debate quality) ───────────────────────
// ponytail: whitelist over algorithmic filter — debate quality needs human judgment
const DEBATE_MODELS: Record<string, string> = {
  'deepseek/deepseek-v4-pro':   'DeepSeek V4 Pro',
  'deepseek/deepseek-v4-flash': 'DeepSeek V4 Flash',
  'deepseek/deepseek-r1':       'DeepSeek R1',
  'anthropic/claude-opus-4.8':  'Claude Opus 4.8',
  'anthropic/claude-sonnet-4.6':'Claude Sonnet 4.6',
  'anthropic/claude-haiku-4.5': 'Claude Haiku 4.5',
  'openai/gpt-5.5-pro':         'GPT-5.5 Pro',
  'openai/gpt-5.4':             'GPT-5.4',
  'openai/gpt-4.1':             'GPT-4.1',
  'google/gemini-3.1-pro-preview': 'Gemini 3.1 Pro',
  'google/gemini-2.5-pro':         'Gemini 2.5 Pro',
  'x-ai/grok-4.20':                'Grok 4.20',
  'meta-llama/llama-4-maverick':   'Llama 4 Maverick',
  'mistralai/mistral-large-2512':  'Mistral Large 3',
  'qwen/qwen3.7-max':              'Qwen 3.7 Max',
};

export async function GET() {
  // Claude CLI backend — short alias list, no API call needed
  if (process.env.CLAUDE_CODE_OAUTH_TOKEN) {
    return NextResponse.json({ models: CLAUDE_MODELS });
  }

  // OpenRouter backend — fetch and filter
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `OpenRouter returned ${res.status}` },
        { status: 502 }
      );
    }

    const { data } = await res.json();
    const models = data
      .filter((m: { id: string }) => m.id in DEBATE_MODELS)
      .sort((a: { id: string }, b: { id: string }) =>
        DEBATE_MODELS[a.id].localeCompare(DEBATE_MODELS[b.id]))
      .map((m: { id: string }) => ({
        id: m.id,
        name: DEBATE_MODELS[m.id],
      }));

    return NextResponse.json({ models });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch models' },
      { status: 500 }
    );
  }
}
