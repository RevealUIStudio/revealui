// Pure scoring logic for the Agent Receipts Audit (/receipts-audit). Kept out
// of the React component so the score-band boundaries are unit-testable in
// isolation. The question copy + band copy live in content/receipts-audit.ts;
// this module only knows how a set of yes/no answers maps to a receipt count
// and a band.

export type AuditAnswer = 'yes' | 'no';

/** The scoreable shape of a question: which answer counts as a receipt. */
export interface ScoredQuestion {
  /** The answer that means "you have a receipt" for this question. Most
   *  questions score a 'yes'; question 5 (unbounded spend) scores a 'no'. */
  readonly positiveAnswer: AuditAnswer;
}

export type BandId = 'strong' | 'partial' | 'trust';

/**
 * Count receipt-positive answers. Unanswered questions (null) never count.
 * `answers[i]` corresponds to `questions[i]`.
 */
export function countReceipts(
  questions: readonly ScoredQuestion[],
  answers: readonly (AuditAnswer | null)[],
): number {
  let count = 0;
  for (let i = 0; i < questions.length; i++) {
    const answer = answers[i];
    if (answer !== null && answer === questions[i]?.positiveAnswer) count += 1;
  }
  return count;
}

/**
 * Map a receipt count to a score band. Boundaries (owner copy):
 *   10-12 → strong  ("You have receipts.")
 *    5-9  → partial ("You have partial receipts.")
 *    0-4  → trust   ("You are running on trust.")
 */
export function bandForScore(score: number): BandId {
  if (score >= 10) return 'strong';
  if (score >= 5) return 'partial';
  return 'trust';
}
