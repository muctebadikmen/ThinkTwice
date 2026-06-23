import type { Scorecard } from './scorecard-parser';

/**
 * Derive the winning option from a verdict.
 *
 * Language-agnostic: prefers the parsed scorecard (highest score in the last
 * numeric column — the "Overall" column by convention). The scorecard is
 * detected structurally by parseScorecard, so this works in any language.
 * Falls back to the English "**Winner: X**" marker only when no scorecard is
 * available (e.g. a verdict without a table).
 */
export function extractWinner(
  verdict: string,
  scorecard?: Scorecard | null
): string | null {
  if (scorecard && scorecard.options.length > 0 && scorecard.scores.length > 0) {
    const overallIdx = scorecard.categories.length - 1;
    let bestOption: string | null = null;
    let bestScore = -Infinity;
    for (let i = 0; i < scorecard.options.length; i++) {
      const score = scorecard.scores[i]?.[overallIdx];
      if (typeof score === 'number' && score > bestScore) {
        bestScore = score;
        bestOption = scorecard.options[i];
      }
    }
    if (bestOption) return bestOption;
  }

  // Fallback: English marker (kept for verdicts without a scorecard table).
  const bold = verdict.match(/\*\*Winner:\s*(.+?)\*\*/i);
  if (bold) return bold[1].trim();
  const plain = verdict.match(/Winner:\s*(.+?)[\n\r*]/i);
  if (plain) return plain[1].trim();
  return null;
}

/**
 * Remove leaked judge-evaluation control markers from text meant for display.
 * A "continue" evaluation streams as "CONTINUE: <reason>" followed by a
 * "SCORES: [A]=7/10, ..." line. Those are control tokens for the parsers, not
 * prose — strip them before rendering. Scores are still parsed separately from
 * the raw text by parseConfidenceScores for the sparkline, so this is
 * display-only.
 *
 * Tolerant of leading markdown/emphasis (e.g. "**CONTINUE:**", "> SCORES:"),
 * matching the parser regexes in lib/orchestrator.ts and lib/confidence-parser.ts.
 */
export function stripEvaluationMarkers(text: string): string {
  return text
    .split('\n')
    .filter((line) => {
      const cleaned = line.trim().replace(/^[>#*_\s-]+/, '');
      return !/^SCORES:/i.test(cleaned);
    })
    .join('\n')
    .replace(/^[\s>#*_-]*CONTINUE:[ \t]*/im, '')
    .trim();
}
