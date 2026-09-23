/**
 * Session token budget for every harness.
 *
 * This module is the only place these numbers are authored.
 * `token-economy` states them. `manager materialize` writes
 * `.revealui/adapters/grok/token-budget.json`. RevKit copies that
 * file to the Grok attach point and sets `compaction_at_tokens` /
 * `auto_compact_threshold_percent` from it. The snapshot script reads
 * the JSON. Do not copy the integers into Claude pressure scores.
 */

export const TOKEN_BUDGET = {
  contextWindowTokens: 500_000,
  compactionAtTokens: 160_000,
  snapshotHeadroomTokens: 40_000,
  models: ['grok-4.7', 'grok-4.7-build'],
  toolOutputCapChars: 30 * 1024,
  toolOutputHeadChars: 12 * 1024,
  toolOutputTailChars: 12 * 1024,
  cappedTools: ['grep', 'run_terminal_command'],
} as const;

export interface TokenBudgetDocument {
  contextWindowTokens: number;
  compactionAtTokens: number;
  snapshotHeadroomTokens: number;
  snapshotGateTokens: number;
  autoCompactThresholdPercent: number;
  models: readonly string[];
  toolOutputCapChars: number;
  toolOutputHeadChars: number;
  toolOutputTailChars: number;
  cappedTools: readonly string[];
}

/** Share of the context window, integer percent. 160_000 / 500_000 = 32. */
export function autoCompactThresholdPercent(
  budget: Pick<typeof TOKEN_BUDGET, 'compactionAtTokens' | 'contextWindowTokens'> = TOKEN_BUDGET,
): number {
  if (budget.contextWindowTokens <= 0) {
    throw new Error('contextWindowTokens must be positive');
  }
  return Math.round((budget.compactionAtTokens / budget.contextWindowTokens) * 100);
}

export function tokenBudgetDocument(
  budget: typeof TOKEN_BUDGET = TOKEN_BUDGET,
): TokenBudgetDocument {
  const autoCompactThresholdPercentValue = autoCompactThresholdPercent(budget);
  return {
    contextWindowTokens: budget.contextWindowTokens,
    compactionAtTokens: budget.compactionAtTokens,
    snapshotHeadroomTokens: budget.snapshotHeadroomTokens,
    snapshotGateTokens: budget.compactionAtTokens - budget.snapshotHeadroomTokens,
    autoCompactThresholdPercent: autoCompactThresholdPercentValue,
    models: budget.models,
    toolOutputCapChars: budget.toolOutputCapChars,
    toolOutputHeadChars: budget.toolOutputHeadChars,
    toolOutputTailChars: budget.toolOutputTailChars,
    cappedTools: budget.cappedTools,
  };
}

export function tokenBudgetJsonText(): string {
  return `${JSON.stringify(tokenBudgetDocument(), null, 2)}\n`;
}
