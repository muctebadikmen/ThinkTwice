import { DebateRound, ExpertPerspective } from '@/types/debate';

// ── Helper: language instruction block ─────────────────────────────────────────

function languageInstruction(language: string): string {
  if (!language || language.toLowerCase() === 'english') return '';
  return `\n\nWrite your entire response in ${language} — all text, analysis, and formatting in ${language}.`;
}

// ── Helper: keep control markers in English even when writing in another language ─

function markerInstruction(language: string): string {
  if (!language || language.toLowerCase() === 'english') return '';
  return `\n\nIMPORTANT: Write the control labels exactly in English — "QUESTION:", "VERDICT:", "CONTINUE:", and "SCORES:" — even though the rest of your response is written in ${language}. Only these label words stay in English; the text after each label is in ${language}.`;
}

// ── Helper: truncate a response to a max word count ─────────────────────────────

function truncateResponse(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ') + ' [... truncated for brevity]';
}

// ── Helper: format previous rounds with smart summarization ─────────────────────
//
// Strategy to prevent context overflow:
// - The LATEST 2 rounds: include full responses (up to 600 words each)
// - Older rounds: include only the judge's question + a brief summary (150 words per response)
// - User clarifications are always included in full (they're short)
//

function formatPreviousRounds(rounds: DebateRound[], mode: 'full' | 'advocate' = 'full'): string {
  if (rounds.length === 0) return '';

  const sections = rounds.map((r, idx) => {
    const isRecent = idx >= rounds.length - 2; // last 2 rounds = "recent"
    const wordLimit = isRecent ? 600 : 150;

    const responsesText = r.responses
      .map((resp) => {
        const text = mode === 'advocate'
          ? truncateResponse(resp.response, wordLimit)
          : truncateResponse(resp.response, wordLimit);
        return `**Advocate for "${resp.option}":**\n${text}`;
      })
      .join('\n\n---\n\n');

    let roundText = `### Round ${r.roundNumber}

**Judge's Question:**
${r.judgeQuestion}

**Advocate Responses:**
${responsesText}`;

    // Include user clarification if present
    if (r.userClarification) {
      roundText += `\n\n**User Clarification (asked after this round):**\nJudge asked: "${r.userClarification.question}"\nUser answered: "${r.userClarification.answer}"`;
    }

    return roundText;
  });

  return `\n\n## Previous Rounds\n\n${sections.join('\n\n---\n\n')}`;
}

// ── Helper: ultra-compact summary for advocate prompts (even leaner) ────────────
//
// Advocates only need to know:
// - What questions were asked
// - Key points opponents made (so they can counter)
// - Their own previous arguments (brief reminder)
//

function formatRoundsForAdvocate(
  rounds: DebateRound[],
  option: string,
): string {
  if (rounds.length === 0) return '';

  const sections = rounds.map((r, idx) => {
    const isRecent = idx >= rounds.length - 1; // only latest round is "recent" for advocates
    const wordLimit = isRecent ? 400 : 100;

    const responsesText = r.responses
      .map((resp) => {
        const label = resp.option === option ? 'Your previous response' : `Opponent "${resp.option}"`;
        return `**${label}:**\n${truncateResponse(resp.response, wordLimit)}`;
      })
      .join('\n\n');

    let roundText = `### Round ${r.roundNumber}\n**Question:** ${r.judgeQuestion}\n\n${responsesText}`;

    if (r.userClarification) {
      roundText += `\n\n**User Clarification:** ${r.userClarification.answer}`;
    }

    return roundText;
  });

  return `\n\n## Debate History (Summary)\n\n${sections.join('\n\n---\n\n')}`;
}

// ── Helper: format expert perspectives block ─────────────────────────────────────

function formatExpertsBlock(experts: ExpertPerspective[] | null | undefined): string {
  if (!experts || experts.length === 0) return '';
  return `\n\nEach advocate argues from a specialized expert perspective:\n${experts.map((e) => `- **${e.option}**: Advocated by a ${e.expert}`).join('\n')}`;
}

// ── 1. Judge Question Prompt ───────────────────────────────────────────────────

/**
 * Judge asks a focused question to all advocates.
 * First round: opening question to differentiate options.
 * Subsequent rounds: follow-up probing weak points or unexplored areas.
 *
 * For continuation debates, the first round includes the user's challenge.
 */
export function judgeQuestionPrompt(
  options: string[],
  context: string,
  previousRounds: DebateRound[],
  language: string = 'English',
  experts: ExpertPerspective[] | null = null,
  userChallenge: string | null = null
): string {
  const contextBlock = context
    ? `\n\nDecision context provided by the user:\n${context}`
    : '';

  const optionsList = options.map((o, i) => `${i + 1}. **${o}**`).join('\n');
  const prevRoundsBlock = formatPreviousRounds(previousRounds);
  const expertsBlock = formatExpertsBlock(experts);

  const isFirstRound = previousRounds.length === 0;
  const roundNumber = previousRounds.length === 0
    ? (previousRounds.length + 1)
    : previousRounds[previousRounds.length - 1].roundNumber + 1;

  // Continuation challenge — first round of a continued debate
  if (isFirstRound && userChallenge) {
    return `You are an impartial, highly analytical judge moderating a CONTINUATION of a structured debate between advocates for the following options:

${optionsList}
${contextBlock}
${expertsBlock}

A previous debate was already conducted on these options and reached a verdict. However, the user was NOT satisfied and has challenged the result with this feedback:

**User's Challenge:** "${userChallenge}"

This is the first round of the continuation debate. Your task:
1. Carefully consider the user's specific objections and concerns.
2. Formulate a question that directly addresses the gap or flaw the user identified.
3. Force the advocates to engage with the user's challenge — don't let them rehash old arguments.
4. The question should be specific and focused on the user's unaddressed concern.

Format your response exactly as follows — the line must start with "QUESTION:":

QUESTION: [Your focused question addressing the user's challenge]

Do NOT include any other text before or after the QUESTION line. Just the question.${languageInstruction(language)}${markerInstruction(language)}`;
  }

  if (isFirstRound) {
    return `You are an impartial, highly analytical judge moderating a structured debate between advocates for the following options:

${optionsList}
${contextBlock}
${expertsBlock}

This is **Round ${roundNumber}** — the opening round.

Your task:
1. Consider the user's decision context and the options being compared.
2. Identify the SINGLE MOST IMPORTANT question that will help differentiate these options and guide the user toward the best choice.
3. The question should be specific, focused, and answerable with research and evidence.
4. Frame the question so that all advocates must address the same point, enabling direct comparison.

Format your response exactly as follows — the line must start with "QUESTION:":

QUESTION: [Your focused question here]

Do NOT include any other text before or after the QUESTION line. Just the question.${languageInstruction(language)}${markerInstruction(language)}`;
  }

  return `You are an impartial, highly analytical judge moderating a structured debate between advocates for the following options:

${optionsList}
${contextBlock}
${expertsBlock}
${prevRoundsBlock}

This is **Round ${roundNumber}**.

Based on the previous rounds of debate, you need to identify the most important REMAINING point of contention or area where the advocates' arguments need further examination.

Your task:
1. Review all previous questions and responses.
2. Identify what remains unclear, contested, or insufficiently addressed.
3. Ask a NEW, focused follow-up question that probes a different angle or digs deeper into a weak point.
4. You may direct a question at a specific advocate if one made a claim that needs scrutiny (e.g., "Advocate for X, respond to Advocate for Y's claim that...").

Format your response exactly as follows — the line must start with "QUESTION:":

QUESTION: [Your focused follow-up question here]

Do NOT include any other text before or after the QUESTION line. Just the question.${languageInstruction(language)}${markerInstruction(language)}`;
}

// ── 2. Advocate Response Prompt ────────────────────────────────────────────────

/**
 * An advocate answers the judge's current question with evidence.
 * Uses a LEAN version of debate history to preserve context for research tools.
 * Supports expert perspective personas.
 */
export function advocateResponsePrompt(
  option: string,
  allOptions: string[],
  context: string,
  judgeQuestion: string,
  roundNumber: number,
  previousRounds: DebateRound[],
  language: string = 'English',
  expertPerspective?: string
): string {
  const opponents = allOptions.filter((o) => o !== option).join(', ');
  const contextBlock = context
    ? `\n\nAdditional context provided by the user:\n${context}`
    : '';
  // Use leaner advocate-specific history
  const prevRoundsBlock = formatRoundsForAdvocate(previousRounds, option);

  const expertBlock = expertPerspective
    ? `\n\n**YOUR EXPERT IDENTITY:** You are a **${expertPerspective}**. You bring deep domain expertise to this debate. Draw on your specialized knowledge, industry experience, and professional insight when making arguments. Reference the kind of data, benchmarks, and considerations that someone with your expertise would prioritize. Your expert perspective should inform HOW you argue, not just WHAT you argue.`
    : '';

  return `You are an expert debate agent. Your sole task is to build the strongest possible case for the following option:

**OPTION YOU ARE DEFENDING: "${option}"**

You are competing against: ${opponents}
${expertBlock}
${contextBlock}
${prevRoundsBlock}

---

## Round ${roundNumber} — Judge's Question

**"${judgeQuestion}"**

---

Instructions:
1. Use WebSearch and WebFetch to find real-world evidence, statistics, expert opinions, and current data that answers the judge's question in favor of "${option}".
2. Directly and thoroughly answer the judge's question. Stay focused — do not ramble about unrelated strengths.
3. If the judge referenced a specific claim by an opponent, address it head-on with counter-evidence.
4. Structure your response clearly:
   - **Direct Answer**: Address the judge's question head-on
   - **Evidence**: Real data, studies, or expert opinions found through research
   - **Why This Favors "${option}"**: Connect your evidence to why "${option}" is the superior choice
5. Be specific, thorough, and persuasive. Back every claim with evidence where possible.
6. Do NOT concede any points. You are a zealous advocate for "${option}".
7. Keep your final response FOCUSED — maximum 800 words. Quality over quantity.

Present your response to the judge's question now.${languageInstruction(language)}`;
}

// ── 3. Judge Evaluation Prompt ─────────────────────────────────────────────────

/**
 * After advocates respond, the judge evaluates whether a clear winner has emerged
 * or whether more questioning is needed.
 */
export function judgeEvaluationPrompt(
  options: string[],
  context: string,
  allRounds: DebateRound[],
  currentRound: number,
  maxRounds: number,
  language: string = 'English',
  experts: ExpertPerspective[] | null = null,
  autoMode: boolean = false
): string {
  const contextBlock = context
    ? `\n\nDecision context provided by the user:\n${context}`
    : '';
  const optionsList = options.map((o, i) => `${i + 1}. **${o}**`).join('\n');
  const roundsBlock = formatPreviousRounds(allRounds);
  const expertsBlock = formatExpertsBlock(experts);

  const isLastRound = currentRound >= maxRounds;

  if (isLastRound) {
    return `You are an impartial, highly analytical judge. A structured debate of ${maxRounds} rounds has been conducted between advocates for the following options:

${optionsList}
${contextBlock}
${expertsBlock}
${roundsBlock}

This was the FINAL round (Round ${currentRound} of ${maxRounds}). You MUST now deliver your verdict.

Analyze ALL arguments and evidence across ALL rounds, then deliver your final verdict. Even if the debate is close, you MUST pick a winner. A tie is NOT allowed — weigh the evidence and make a decision.

Format your response exactly as follows. The first line of your response must be "VERDICT:":

VERDICT:

**Winner: [Winning Option]**

**Why it wins:**
[2-4 specific reasons based on the debate evidence across all rounds]

**What the losing side(s) got wrong:**
[Key weaknesses in the losing argument(s)]

**Key moment in the debate:**
[Which round or exchange was most decisive and why]

**Confidence level:** [High / Medium / Low] — [explain why]

**Scores (1-10):**
| Option | Evidence | Relevance | Practicality | Overall |
| --- | --- | --- | --- | --- |
${options.map((o) => `| ${o} | X | X | X | X |`).join('\n')}

Replace each X with a score from 1-10.

SCORES: ${options.map((o) => `[${o}]=X/10`).join(', ')}

Replace each X with the Overall score for that option.${languageInstruction(language)}${markerInstruction(language)}`;
  }

  const clarificationBlock = autoMode
    ? `

Do NOT include a CLARIFICATION line. The user has enabled auto-pilot mode — you must make your best judgment using only the context already provided. Never pause the debate to ask the user questions.`
    : `

CLARIFICATION: [Optional — only include this line if you genuinely need specific CONTEXTUAL information from the USER to evaluate better. Ask a brief, direct question about their SITUATION, CONSTRAINTS, or REQUIREMENTS — things only they would know.

Good examples: budget range, timeline/deadline, must-have features, technical environment, team size, experience level, where they'll use it, how often they'll use it.

NEVER ask the user which option they prefer, which they're leaning towards, or anything that asks them to make the decision for you. YOUR job is to determine the winner — the user's job is only to provide missing context about their situation. Do NOT ask this every round — only when truly needed and when user context is genuinely missing.]`;

  const considerMissingContext = autoMode
    ? ''
    : '\n- Is there missing CONTEXT about the user\'s situation (budget, timeline, constraints, environment, use case) that would help you evaluate better? (Never ask the user which option they prefer — that\'s YOUR job.)';

  return `You are an impartial, highly analytical judge. You are moderating a structured debate between advocates for the following options:

${optionsList}
${contextBlock}
${expertsBlock}
${roundsBlock}

You have completed Round ${currentRound} of a maximum ${maxRounds} rounds.

Your task: Evaluate the current state of the debate and decide whether:
A) A clear winner has emerged and you can deliver a final verdict now, OR
B) The debate needs more exploration and you should continue to the next round.

Consider:
- Has one side consistently provided stronger evidence?
- Are there important aspects that haven't been explored yet?
- Is one side failing to adequately counter the other's strongest points?
- Would another round of questioning meaningfully change the outcome?${considerMissingContext}

Respond with exactly one of the following two formats:

**If you want to continue the debate** (the line must start with "CONTINUE:"):
CONTINUE: [Brief 1-sentence explanation of why more questioning is needed]
${clarificationBlock}

SCORES: ${options.map((o) => `[${o}]=X/10`).join(', ')}

Replace each X with a score from 1-10 rating that option's strength this round.

**If you are ready to deliver a verdict** (the first line must start with "VERDICT:"):
VERDICT:

**Winner: [Winning Option]**

**Why it wins:**
[2-4 specific reasons based on the debate evidence across all rounds]

**What the losing side(s) got wrong:**
[Key weaknesses in the losing argument(s)]

**Key moment in the debate:**
[Which round or exchange was most decisive and why]

**Confidence level:** [High / Medium / Low] — [explain why]

**Scores (1-10):**
| Option | Evidence | Relevance | Practicality | Overall |
| --- | --- | --- | --- | --- |
${options.map((o) => `| ${o} | X | X | X | X |`).join('\n')}

Replace each X with a score from 1-10.

SCORES: ${options.map((o) => `[${o}]=X/10`).join(', ')}

Replace each X with the Overall score for that option.

Choose carefully. Only deliver a verdict if you are reasonably confident. If important angles remain unexplored, continue the debate.${languageInstruction(language)}${markerInstruction(language)}`;
}
