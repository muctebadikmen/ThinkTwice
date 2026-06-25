import { NextRequest, NextResponse } from 'next/server';
import { runClaude, ClaudeRunnerError } from '@/lib/claude-runner';

/**
 * POST /api/parse-prompt
 *
 * Takes a single free-form prompt describing a decision and uses Claude to
 * extract structured options, context, and expert perspectives.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { prompt, language, model } = body as {
    prompt: string;
    language?: string;
    model?: string;
  };

  if (!prompt || prompt.trim().length < 10) {
    return NextResponse.json(
      { error: 'Please describe your decision in more detail.' },
      { status: 400 }
    );
  }

  const lang = language?.trim() || 'English';

  const parsePrompt = `You are a decision analysis assistant. A user has described a decision they need help with in free-form text. Your job is to extract the structured components needed to run a debate.

USER'S INPUT:
"""
${prompt.trim()}
"""

Analyze this and extract:
1. **Options**: The distinct choices/options the user is deciding between. There must be at least 2 and at most 6 options. If the user hasn't explicitly listed options but described a dilemma, infer the most logical options. For yes/no decisions, create "Yes — [do the thing]" and "No — [don't do the thing / alternative]" as options.
2. **Context**: All relevant context about the user's situation — their constraints, priorities, budget, timeline, experience level, location, requirements, preferences, etc. Consolidate everything that isn't an option into context.
3. **Expert perspectives**: For each option, suggest what type of expert would best advocate for it. Be specific and creative — not just "Tech Expert" but "Senior iOS Developer with 10 years of mobile experience" or "Financial Advisor specializing in early-career professionals". Match the expert to both the option AND the user's situation.

LANGUAGE: Write every human-readable VALUE — each option "name", each "expert" description, and the "context" — in ${lang}. The JSON keys ("options", "name", "expert", "context") MUST stay in English exactly as shown; translate only the values, never the keys.

You MUST respond with ONLY a valid JSON object in this exact format (no markdown, no code fences, no explanation):
{"options":[{"name":"Option name","expert":"Expert title and specialization"}],"context":"Consolidated context string"}

Rules:
- Option names should be concise but clear (2-8 words)
- Expert descriptions should be specific and relevant (8-20 words)
- Context should capture everything relevant about the user's situation
- If the user mentions a preference or leaning, include it in context but still create balanced options
- Minimum 2 options, maximum 6 options
- Every value (option names, expert descriptions, context) MUST be written in ${lang}
- Respond with ONLY the JSON object, nothing else`;

  try {
    const result = await runClaude(
      parsePrompt,
      () => {}, // no streaming needed
      undefined,
      model ?? 'sonnet'
    );

    // Extract JSON from the response (handle possible markdown wrapping)
    let jsonStr = result.trim();
    // Strip markdown code fences if present
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(jsonStr) as {
      options: { name: string; expert: string }[];
      context: string;
    };

    if (!parsed.options || parsed.options.length < 2) {
      return NextResponse.json(
        { error: 'Could not identify enough options from your description. Please be more specific.' },
        { status: 422 }
      );
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error('[parse-prompt] Failed to parse:', err);
    // Surface a real CLI/auth failure so the user can fix the actual cause
    // instead of seeing a generic "try again" message.
    if (err instanceof ClaudeRunnerError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.isAuthError ? 401 : 502 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to analyze your decision. Please try again or use manual mode.' },
      { status: 500 }
    );
  }
}
