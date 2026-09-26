/**
 * Post-action meter for governed MCP tool calls (spec 02 slice 2).
 *
 * Counts one `governed_actions` unit against the account scope, and against
 * the registered agent id when the caller has one. This is a record, not a
 * checkout: the tool call already ran, so the unit is added even if it
 * crosses a hard stop (same honest overshoot as cost). Slice 3 owns the
 * pre-action reserve and must not also increment this unit.
 *
 * `REVEALUI_BUDGETS_MODE=off` (the default) returns before any budget write.
 */

import {
  BUDGET_SYSTEM_AGENT_ID,
  type BudgetAuditWriter,
  type BudgetDb,
  type BudgetMode,
  type BudgetRecordResult,
  type BudgetScopeRef,
  currentBudgetsMode,
  getClient,
  recordBudgetSpend,
} from '@revealui/db';

export interface GovernedMcpActionInput {
  accountId: string;
  /** Stable registered agent id. Omitted when the call has no agent definition. */
  agentId?: string | null;
  at?: Date;
  mode?: BudgetMode;
  db?: BudgetDb;
  audit?: BudgetAuditWriter;
}

async function defaultAuditStore(): Promise<BudgetAuditWriter> {
  const { createAuditStore } = await import('@revealui/auth/audit-storage');
  return createAuditStore(getClient());
}

export async function recordGovernedMcpAction(
  input: GovernedMcpActionInput,
): Promise<BudgetRecordResult | null> {
  const mode = input.mode ?? currentBudgetsMode();
  if (mode === 'off') return null;

  const scopes: BudgetScopeRef[] = [{ scopeType: 'account', scopeId: input.accountId }];
  if (input.agentId && input.agentId.length > 0) {
    scopes.push({ scopeType: 'agent', scopeId: input.agentId });
  }

  const db = input.db ?? getClient();
  const audit = input.audit ?? (input.db ? undefined : await defaultAuditStore());
  return recordBudgetSpend(
    db,
    {
      accountId: input.accountId,
      scopes,
      metric: 'governed_actions',
      units: 1,
      at: input.at,
      mode,
      actorAgentId:
        input.agentId && input.agentId.length > 0 ? input.agentId : BUDGET_SYSTEM_AGENT_ID,
    },
    audit,
  );
}
