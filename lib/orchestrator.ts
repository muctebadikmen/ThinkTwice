import { runClaude } from './model-runner';
import {
  judgeQuestionPrompt,
  advocateResponsePrompt,
  judgeEvaluationPrompt,
} from './prompts';
import { DebateEvent, DebateRound, AdvocateRoundResponse, UserClarification, ExpertPerspective } from '@/types/debate';

export type EmitFn = (event: DebateEvent) => void;

/** Callback that pauses the orchestrator until the user responds. */
export type WaitForUserInputFn = (question: string) => Promise<string>;

/**
 * Default max rounds. The orchestrator may grant additional rounds if the judge
 * consistently decides to continue and is making progress.
 */
const DEFAULT_MAX_ROUNDS = 8;

/**
 * Absolute ceiling — even with extensions, never exceed this.
 */
const ABSOLUTE_MAX_ROUNDS = 12;

/**
 * For continuation debates, run fewer additional rounds since we already have context.
 */
const CONTINUATION_MAX_ROUNDS = 4;

/**
 * Minimum response length to consider a response "substantive".
 * Must be high enough to catch planning-only responses like
 * "I'll research evidence to build the strongest case..." (~90 chars).
 * A real researched response is typically 500+ chars.
 */
const MIN_RESPONSE_LENGTH = 200;

// ── Structured Output Parsers ────────────────────────────────────────────────

/**
 * Parse the judge's question output.
 * Expects a line starting with "QUESTION:".
 * Falls back to using the entire text as the question.
 */
function parseJudgeQuestion(rawText: string): string {
  const text = rawText.trim();

  // Match the "QUESTION:" marker case-insensitively at a line start, tolerating
  // leading markdown/emphasis the model may add (e.g. "**QUESTION:**", "> QUESTION:").
  const match = text.match(/^[\s>#*_-]*QUESTION:\s*/im);
  if (match) {
    const after = text.slice(match.index! + match[0].length).trim();
    // Take the first non-empty line as the question, stripping bold markers.
    const firstLine = after
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.length > 0);
    if (firstLine) return firstLine.replace(/\*\*/g, '').trim();
  }

  // Fallback: strip any stray marker/emphasis and treat the whole output as the question.
  return text.replace(/QUESTION:/i, '').replace(/\*\*/g, '').trim();
}

interface JudgeEvaluationResult {
  decision: 'continue' | 'verdict';
  content: string;
  clarification?: string;  // Optional: judge wants to ask the user
}

/**
 * Parse the judge's evaluation output.
 * Expects either "CONTINUE: ..." or "VERDICT:\n...".
 * Also extracts optional "CLARIFICATION: ..." line.
 * Falls back with heuristics, defaulting to 'continue' for safety.
 */
function parseJudgeEvaluation(rawText: string): JudgeEvaluationResult {
  const trimmed = rawText.trim();

  // Detect markers at a line start, tolerating leading markdown/emphasis. Using a
  // line-start match (instead of indexOf anywhere) avoids misclassifying a CONTINUE
  // explanation that merely mentions the word "VERDICT:" as an actual verdict.
  const verdictMatch = trimmed.match(/^[\s>#*_-]*VERDICT:\s*/im);
  if (verdictMatch) {
    const verdictContent = trimmed.slice(verdictMatch.index! + verdictMatch[0].length).trim();
    return { decision: 'verdict', content: verdictContent };
  }

  // Optional CLARIFICATION line — only honour a real question (not the placeholder).
  let clarification: string | undefined;
  const clarMatch = trimmed.match(/^[\s>#*_-]*CLARIFICATION:[ \t]*(.*)$/im);
  if (clarMatch) {
    const text = clarMatch[1].trim();
    if (text && !text.startsWith('[')) {
      clarification = text;
    }
  }

  // CONTINUE marker (line start, tolerant of emphasis).
  const continueMatch = trimmed.match(/^[\s>#*_-]*CONTINUE:[ \t]*(.*)$/im);
  if (continueMatch) {
    return { decision: 'continue', content: continueMatch[1].trim(), clarification };
  }

  // Fallback heuristic: a "Winner:" line strongly implies a verdict.
  if (/\*{0,2}Winner:/i.test(trimmed)) {
    return { decision: 'verdict', content: trimmed };
  }

  // Default: treat as continue to avoid premature termination.
  return { decision: 'continue', content: trimmed, clarification };
}

// ── Single Advocate Runner (with retry) ──────────────────────────────────────

async function runAdvocateRound(
  agentIndex: number,
  option: string,
  allOptions: string[],
  context: string,
  judgeQuestion: string,
  roundNumber: number,
  previousRounds: DebateRound[],
  emit: EmitFn,
  signal?: AbortSignal,
  language: string = 'English',
  model: string = 'sonnet',
  expertPerspective?: string
): Promise<string> {
  const prompt = advocateResponsePrompt(
    option,
    allOptions,
    context,
    judgeQuestion,
    roundNumber,
    previousRounds,
    language,
    expertPerspective
  );

  // First attempt
  let result = await runClaude(
    prompt,
    (chunk) =>
      emit({
        type: 'agent_chunk',
        agentIndex,
        round: roundNumber,
        phase: 'advocate_response',
        chunk,
      }),
    signal,
    model
  );

  // If response is too short (likely a planning-only stub or tool failure), retry
  if (result.length < MIN_RESPONSE_LENGTH) {
    console.error(
      `[orchestrator] Advocate ${agentIndex} ("${option}") produced only ${result.length} chars in round ${roundNumber}. Retrying with simplified prompt...`
    );

    // Clear the stub text and show retry notice
    emit({
      type: 'agent_chunk',
      agentIndex,
      round: roundNumber,
      phase: 'advocate_response',
      chunk: '\n\n---\n\n',
    });

    const expertBlock = expertPerspective
      ? ` You are speaking as a ${expertPerspective}.`
      : '';

    // Simplified retry prompt — explicit instruction NOT to just plan, but to respond directly
    const retryPrompt = `You are a debate advocate defending "${option}" against ${allOptions.filter((o) => o !== option).join(', ')}.${expertBlock}

${context ? `Context: ${context}\n` : ''}
The judge asks: "${judgeQuestion}"

Provide a complete, substantive response with real arguments and evidence now — don't just describe what you will research, give your actual analysis and arguments.

Research and answer this question with strong evidence favoring "${option}". Use WebSearch to find current data. Keep your response focused and under 600 words.${languageInstruction(language)}`;

    const retryResult = await runClaude(
      retryPrompt,
      (chunk) =>
        emit({
          type: 'agent_chunk',
          agentIndex,
          round: roundNumber,
          phase: 'advocate_response',
          chunk,
        }),
      signal,
      model
    );

    // Use the retry result if it's substantive; otherwise keep whatever we have
    if (retryResult.length >= MIN_RESPONSE_LENGTH) {
      result = retryResult; // Replace with the better retry result
    } else if (retryResult.length > result.length) {
      result = retryResult;
    }
  }

  emit({ type: 'agent_done', agentIndex, round: roundNumber, phase: 'advocate_response' });
  return result;
}

// ── Helper: language instruction for retry prompts ──────────────────────────

function languageInstruction(language: string): string {
  if (!language || language.toLowerCase() === 'english') return '';
  return `\n\nWrite your entire response in ${language}.`;
}

// ── Main Orchestration Loop ──────────────────────────────────────────────────

/**
 * Orchestrates a dynamic, judge-moderated multi-round debate:
 * 1. Judge asks a question
 * 2. All advocates respond in parallel
 * 3. Judge evaluates — continue or deliver verdict
 * 4. Optionally: judge asks user for clarification (debate pauses)
 * 5. Loop until verdict or max rounds
 *
 * Max rounds is dynamic: starts at DEFAULT_MAX_ROUNDS but the judge can
 * extend if the debate is genuinely close and productive.
 *
 * Supports expert perspectives and continuation from a previous debate.
 */
export async function runDebate(
  options: string[],
  context: string,
  emit: EmitFn,
  waitForUserInput: WaitForUserInputFn | null,
  signal?: AbortSignal,
  language: string = 'English',
  model: string = 'sonnet',
  experts: ExpertPerspective[] | null = null,
  previousDebateData: { rounds: DebateRound[]; verdict: string } | null = null,
  userChallenge: string | null = null,
  autoMode: boolean = false
): Promise<void> {
  const completedRounds: DebateRound[] = [];

  // For continuation debates, use fewer rounds and inject prior context
  const isContinuation = previousDebateData !== null && userChallenge !== null;
  let currentMaxRounds = isContinuation ? CONTINUATION_MAX_ROUNDS : DEFAULT_MAX_ROUNDS;

  // Build expert lookup map: option name -> expert description
  const expertMap = new Map<string, string>();
  if (experts) {
    for (const e of experts) {
      expertMap.set(e.option, e.expert);
    }
  }

  // Build augmented context for continuation debates
  let augmentedContext = context;
  if (isContinuation && previousDebateData && userChallenge) {
    const prevSummary = previousDebateData.rounds
      .map(
        (r) =>
          `Round ${r.roundNumber}: "${r.judgeQuestion}" — ${r.responses.map((resp) => `${resp.option}: ${resp.response.slice(0, 200)}...`).join('; ')}`
      )
      .join('\n');

    augmentedContext = `${context}

=== PREVIOUS DEBATE CONTEXT ===
A previous debate was conducted on these same options and reached a verdict.

Previous verdict summary:
${previousDebateData.verdict.slice(0, 800)}

Previous debate rounds summary:
${prevSummary}

=== USER CHALLENGE ===
The user was NOT satisfied with the previous verdict and is challenging it with the following feedback:
"${userChallenge}"

IMPORTANT: You must address the user's specific concerns. The previous debate missed or inadequately covered what the user is pointing out. Focus on these gaps and reconsider the evidence.
=== END PREVIOUS CONTEXT ===`;
  }

  // Adjust round numbering for continuation
  const roundOffset = isContinuation && previousDebateData
    ? previousDebateData.rounds.length
    : 0;

  for (let i = 1; i <= currentMaxRounds; i++) {
    const roundNumber = roundOffset + i;

    // ── Step A: Judge asks a question ──────────────────────────────────────
    emit({ type: 'round_start', round: roundNumber, maxRounds: roundOffset + currentMaxRounds });
    emit({ type: 'phase_start', phase: 'judge_question', round: roundNumber });

    const questionPromptText = judgeQuestionPrompt(
      options,
      augmentedContext,
      completedRounds,
      language,
      experts,
      isContinuation && i === 1 ? userChallenge : null
    );

    const rawQuestion = await runClaude(
      questionPromptText,
      (chunk) =>
        emit({
          type: 'judge_question_chunk',
          round: roundNumber,
          chunk,
        }),
      signal,
      model
    );

    const question = parseJudgeQuestion(rawQuestion);
    emit({ type: 'judge_question_done', round: roundNumber, chunk: question });

    // ── Step B: All advocates respond in parallel ─────────────────────────
    emit({ type: 'phase_start', phase: 'advocate_response', round: roundNumber });

    const advocateResults = await Promise.all(
      options.map((option, idx) =>
        runAdvocateRound(
          idx,
          option,
          options,
          augmentedContext,
          question,
          roundNumber,
          completedRounds,
          emit,
          signal,
          language,
          model,
          expertMap.get(option)
        )
      )
    );

    // Build the round record
    const responses: AdvocateRoundResponse[] = options.map((option, idx) => ({
      agentIndex: idx,
      option,
      response: advocateResults[idx],
    }));

    const thisRound: DebateRound = {
      roundNumber,
      judgeQuestion: question,
      responses,
    };

    completedRounds.push(thisRound);

    // ── Step C: Judge evaluates ───────────────────────────────────────────
    const isLastRound = i >= currentMaxRounds;
    emit({ type: 'phase_start', phase: 'evaluation', round: roundNumber });

    const evalPromptText = judgeEvaluationPrompt(
      options,
      augmentedContext,
      completedRounds,
      roundNumber,
      roundOffset + currentMaxRounds,
      language,
      experts,
      autoMode
    );

    const rawEvaluation = await runClaude(
      evalPromptText,
      (chunk) =>
        emit({
          type: 'evaluation_chunk',
          round: roundNumber,
          chunk,
        }),
      signal,
      model
    );

    let evaluation = parseJudgeEvaluation(rawEvaluation);

    // ── Last-round safety: if the judge didn't produce a VERDICT, force one ──
    if (isLastRound && evaluation.decision !== 'verdict') {
      console.error(
        `[orchestrator] Last round (${roundNumber}) but judge didn't produce VERDICT. Forcing verdict generation...`
      );

      // Clear the previous (non-verdict) evaluation UI
      emit({
        type: 'evaluation_done',
        round: roundNumber,
        decision: 'verdict',
      });

      const expertsBlock = experts
        ? `\nNote: Each advocate argued from an expert perspective:\n${experts.map((e) => `- ${e.option}: ${e.expert}`).join('\n')}\n`
        : '';

      // Generate verdict explicitly with a very clear forced prompt
      const forcedVerdictPrompt = `You are a judge who has evaluated a ${roundNumber}-round debate between: ${options.join(' vs ')}.
${expertsBlock}
${augmentedContext ? `User context: ${augmentedContext}\n` : ''}

Here is a summary of the debate:
${completedRounds.map((r) => `Round ${r.roundNumber}: "${r.judgeQuestion}" — ${r.responses.map((resp) => `${resp.option} argued: ${resp.response.slice(0, 200)}...`).join('; ')}`).join('\n')}

Now deliver your final verdict. Pick a clear winner — a tie is not allowed.

Begin your response with "VERDICT:" followed by your analysis.

VERDICT:

**Winner: [pick one of: ${options.join(', ')}]**

**Why it wins:** [2-4 reasons]

**What the losing side(s) got wrong:** [key weaknesses]

**Key moment in the debate:** [which round was decisive]

**Confidence level:** [High/Medium/Low] — [explanation]

**Scores (1-10):**
| Option | Evidence | Relevance | Practicality | Overall |
| --- | --- | --- | --- | --- |
${options.map((o) => `| ${o} | X | X | X | X |`).join('\n')}

Replace each X with a score from 1-10.

SCORES: ${options.map((o) => `[${o}]=X/10`).join(', ')}

Replace each X with the Overall score for that option.${languageInstruction(language)}`;

      emit({ type: 'phase_start', phase: 'verdict' });

      // Accumulate the forced verdict without streaming raw chunks — otherwise
      // the "VERDICT:" prefix leaks into the UI. We strip it and emit the
      // cleaned verdict as a single chunk, matching the normal verdict path.
      let verdictText = '';
      const forcedResult = await runClaude(
        forcedVerdictPrompt,
        (chunk) => {
          verdictText += chunk;
        },
        signal,
        model
      );

      // Strip "VERDICT:" prefix if present
      let finalVerdict = forcedResult || verdictText;
      const vIdx = finalVerdict.indexOf('VERDICT:');
      if (vIdx !== -1) {
        finalVerdict = finalVerdict.slice(vIdx + 'VERDICT:'.length).trim();
      }

      emit({ type: 'verdict_chunk', chunk: finalVerdict });
      emit({ type: 'verdict_done' });
      return;
    }

    emit({
      type: 'evaluation_done',
      round: roundNumber,
      decision: evaluation.decision,
    });

    // ── Step C.5: Handle user clarification (optional) ───────────────────
    if (
      evaluation.decision === 'continue' &&
      evaluation.clarification &&
      waitForUserInput
    ) {
      // Emit events so the UI shows the input form
      emit({ type: 'phase_start', phase: 'user_input', round: roundNumber });
      emit({
        type: 'user_input_request',
        round: roundNumber,
        question: evaluation.clarification,
      });

      // Block until user responds (or auto-timeout after 15 min)
      const userAnswer = await waitForUserInput(evaluation.clarification);

      // Emit confirmation so the UI updates
      emit({
        type: 'user_input_received',
        round: roundNumber,
        userInput: userAnswer,
      });

      // Attach to round record for future prompt context
      const lastRound = completedRounds[completedRounds.length - 1];
      if (lastRound) {
        lastRound.userClarification = {
          afterRound: roundNumber,
          question: evaluation.clarification,
          answer: userAnswer,
        } satisfies UserClarification;
      }
    }

    // ── Step D: Branch on decision ────────────────────────────────────────
    if (evaluation.decision === 'verdict') {
      emit({ type: 'phase_start', phase: 'verdict' });
      emit({ type: 'verdict_chunk', chunk: evaluation.content });
      emit({ type: 'verdict_done' });
      return;
    }

    // Otherwise, loop continues to next round
  }

  // Safety net: should not reach here due to forced verdict above,
  // but handle it gracefully anyway.
  emit({ type: 'phase_start', phase: 'verdict' });
  emit({
    type: 'verdict_chunk',
    chunk: 'Maximum rounds reached. The judge was unable to reach a definitive verdict within the allotted rounds.',
  });
  emit({ type: 'verdict_done' });
}
