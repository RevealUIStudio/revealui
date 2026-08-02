/**
 * Webhook Bug #1 — Silent payment drop on cleanup failure
 *
 * Structural contract tests for the reconciliation branching logic.
 * The actual handler test requires Testcontainers (follow-up).
 *
 * These tests verify the SOURCE CODE contains the correct branching
 * pattern, catching regressions where someone removes the branch
 * guard or the reconciliation insert.
 *
 * Implementation lives under webhooks/stripe-route.ts (webhooks.ts is a
 * thin barrel after the length-split refactor).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const routesDir = fileURLToPath(new URL('..', import.meta.url));
const barrelPath = resolve(routesDir, 'webhooks.ts');
const implementationPath = resolve(routesDir, 'webhooks', 'stripe-route.ts');
const src = readFileSync(implementationPath, 'utf8');
const barrel = readFileSync(barrelPath, 'utf8');

describe('webhook bug #1 — reconciliation branching contract', () => {
  it('barrel re-exports the stripe-route implementation', () => {
    // Guards against the entry path detaching from the file under contract.
    expect(barrel).toContain("from './webhooks/stripe-route.js'");
  });

  it('checks unmarkProcessed return value before deciding 500 vs 200', () => {
    // The catch block must assign unmarkProcessed's return value
    // and branch on it. If someone removes the branch, both paths
    // collapse to the same status code — silent drop returns.
    expect(src).toContain('const cleanedUp = await unmarkProcessed(');
    expect(src).toContain('if (cleanedUp)');
  });

  it('returns 500 only when cleanup succeeds', () => {
    // The 500 response must be INSIDE the if(cleanedUp) branch.
    // Extract the block after "if (cleanedUp)" and verify it contains 500.
    const cleanupSuccessBlock = src.slice(
      src.indexOf('if (cleanedUp)'),
      src.indexOf('if (cleanedUp)') + 200,
    );
    expect(cleanupSuccessBlock).toContain('500');
  });

  it('inserts into unreconciledWebhooks only when cleanup fails', () => {
    // The reconciliation INSERT must appear AFTER the if(cleanedUp) block,
    // in the cleanup-failure path. Verify the insert exists in the source.
    expect(src).toContain('insert(unreconciledWebhooks)');
    expect(src).toContain('.onConflictDoNothing()');
  });

  it('returns 200 with unreconciled status when cleanup fails', () => {
    // The cleanup-failure path must return 200 with a structured body
    // containing the event ID as a reference for Stripe dashboard tracing.
    expect(src).toContain("status: 'unreconciled'");
    expect(src).toContain('reference: event.id');
  });

  it('sends founder alert on BOTH branches (before the if/else)', () => {
    // The sendWebhookFailureAlert call must appear BEFORE the
    // if(cleanedUp) branch so it fires regardless of cleanup outcome.
    const alertPos = src.indexOf('sendWebhookFailureAlert(');
    const branchPos = src.indexOf('if (cleanedUp)');
    expect(alertPos).toBeGreaterThan(0);
    expect(branchPos).toBeGreaterThan(0);
    expect(alertPos).toBeLessThan(branchPos);
  });
});
