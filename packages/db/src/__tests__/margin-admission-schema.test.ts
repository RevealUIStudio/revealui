/**
 * GAP-256 PR-1 — schema shape smoke (no DB).
 * Proves Drizzle tables export expected columns and signup source is allowed in type surface.
 */
import { describe, expect, it } from 'vitest';
import { accountEntitlements } from '../schema/accounts.js';
import {
  accountMarginDaily,
  admissionWaitlist,
  marginSnapshots,
} from '../schema/margin-admission.js';

describe('GAP-256 margin-admission schema', () => {
  it('exports margin_snapshots columns used by the governor snapshot job', () => {
    expect(marginSnapshots.periodDate.name).toBe('period_date');
    expect(marginSnapshots.totalCostCents.name).toBe('total_cost_cents');
    expect(marginSnapshots.revenueCents.name).toBe('revenue_cents');
    expect(marginSnapshots.mode.name).toBe('mode');
    expect(marginSnapshots.rates.name).toBe('rates');
    expect(marginSnapshots.trend.name).toBe('trend');
  });

  it('exports account_margin_daily with cost separate from agent_tasks', () => {
    expect(accountMarginDaily.costCents.name).toBe('cost_cents');
    expect(accountMarginDaily.agentTasks.name).toBe('agent_tasks');
    expect(accountMarginDaily.revenueCents.name).toBe('revenue_cents');
  });

  it('exports admission_waitlist distinct from marketing waitlist', () => {
    expect(admissionWaitlist.email.name).toBe('email');
    expect(admissionWaitlist.tokenHash.name).toBe('token_hash');
    expect(admissionWaitlist.status.name).toBe('status');
  });

  it('models COGS breaker columns and signup source on account_entitlements', () => {
    expect(accountEntitlements.cogsBreakerTrippedAt.name).toBe('cogs_breaker_tripped_at');
    expect(accountEntitlements.cogsBreakerReason.name).toBe('cogs_breaker_reason');
    expect(accountEntitlements.source.name).toBe('source');
  });
});
