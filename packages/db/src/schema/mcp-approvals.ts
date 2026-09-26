/**
 * Governed MCP exact-call approvals.
 *
 * These tables are mutable operational state for the hosted `/api/mcp` gate.
 * The tamper-evident record is the signed `audit_log` stream. Hosted rows live
 * in Neon. The RevDev daemon keeps its own pending approvals in local PGlite
 * and is not synced here.
 */

import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { accounts } from './accounts.js';
import { users } from './users.js';

export const MCP_TOOL_APPROVAL_STATUSES = [
  'pending',
  'approved',
  'denied',
  'consumed',
  'expired',
] as const;

export type McpToolApprovalStatus = (typeof MCP_TOOL_APPROVAL_STATUSES)[number];

export const mcpToolApprovals = pgTable(
  'mcp_tool_approvals',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    requesterUserId: text('requester_user_id')
      .notNull()
      .references(() => users.id),
    clientName: text('client_name').notNull(),
    mcpSessionId: text('mcp_session_id'),
    tool: text('tool').notNull(),
    argsHash: text('args_hash').notNull(),
    toolSchemaHash: text('tool_schema_hash').notNull(),
    callDigest: text('call_digest').notNull(),
    /** Redacted preview for the approver. Raw arguments never enter audit_log. */
    argsPreview: jsonb('args_preview').$type<Record<string, unknown>>().notNull(),
    status: text('status').$type<McpToolApprovalStatus>().notNull().default('pending'),
    decidedByUserId: text('decided_by_user_id').references(() => users.id),
    decisionNote: text('decision_note'),
    requestedAt: timestamp('requested_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    consumeBy: timestamp('consume_by', { withTimezone: true }),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    /** Set when consumption came from a trust rule. No FK: the rule row is optional. */
    trustRuleId: text('trust_rule_id'),
  },
  (table) => [
    index('mcp_tool_approvals_account_status_idx').on(table.accountId, table.status),
    index('mcp_tool_approvals_digest_idx').on(table.callDigest),
    check(
      'mcp_tool_approvals_status_check',
      sql`status IN ('pending', 'approved', 'denied', 'consumed', 'expired')`,
    ),
  ],
);

export const mcpToolTrustRules = pgTable(
  'mcp_tool_trust_rules',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    /**
     * ON DELETE CASCADE so an account delete can remove the source approval
     * without tripping a NO ACTION edge from this row. The spec left the
     * delete action unspecified.
     */
    sourceApprovalId: text('source_approval_id')
      .notNull()
      .references(() => mcpToolApprovals.id, { onDelete: 'cascade' }),
    requesterUserId: text('requester_user_id').notNull(),
    tool: text('tool').notNull(),
    argsHash: text('args_hash').notNull(),
    toolSchemaHash: text('tool_schema_hash').notNull(),
    maxUses: integer('max_uses'),
    uses: integer('uses').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdByUserId: text('created_by_user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    lapsedAt: timestamp('lapsed_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedByUserId: text('revoked_by_user_id'),
  },
  (table) => [
    uniqueIndex('mcp_tool_trust_rules_active_uq')
      .on(table.accountId, table.requesterUserId, table.tool, table.argsHash, table.toolSchemaHash)
      .where(sql`${table.revokedAt} IS NULL AND ${table.lapsedAt} IS NULL`),
  ],
);

export const mcpApprovalSettings = pgTable('mcp_approval_settings', {
  accountId: text('account_id')
    .primaryKey()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  requireTools: jsonb('require_tools').$type<string[]>().notNull().default([]),
  updatedByUserId: text('updated_by_user_id').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type McpToolApproval = typeof mcpToolApprovals.$inferSelect;
export type NewMcpToolApproval = typeof mcpToolApprovals.$inferInsert;
export type McpToolTrustRule = typeof mcpToolTrustRules.$inferSelect;
export type NewMcpToolTrustRule = typeof mcpToolTrustRules.$inferInsert;
export type McpApprovalSettings = typeof mcpApprovalSettings.$inferSelect;
export type NewMcpApprovalSettings = typeof mcpApprovalSettings.$inferInsert;
