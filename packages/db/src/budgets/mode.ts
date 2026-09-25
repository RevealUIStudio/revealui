/**
 * REVEALUI_BUDGETS_MODE = off (default) | shadow | enforce.
 * Unknown non-empty values fail closed to enforce.
 * Tests override the process env through configureBudgetsMode.
 *
 * `off` writes nothing. `shadow` writes ledgers, incidents, and
 * `budget:would_deny` but does not refuse work. `enforce` refuses.
 */

export const BUDGET_MODES = ['off', 'shadow', 'enforce'] as const;

export type BudgetMode = (typeof BUDGET_MODES)[number];

const MODE_SET: ReadonlySet<string> = new Set(BUDGET_MODES);

let override: BudgetMode | null = null;

export function configureBudgetsMode(mode: BudgetMode | null): void {
  override = mode;
}

export function parseBudgetsMode(value: string | undefined | null): BudgetMode {
  if (value === undefined || value === null || value === '') return 'off';
  if (MODE_SET.has(value)) return value as BudgetMode;
  return 'enforce';
}

export function currentBudgetsMode(
  env: Record<string, string | undefined> = process.env,
): BudgetMode {
  if (override !== null) return override;
  return parseBudgetsMode(env.REVEALUI_BUDGETS_MODE);
}
