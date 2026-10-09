/**
 * Process-wide result of the last audit storage self-test.
 *
 * The boot self-test runs in the instrumentation chunk and the health route
 * runs in a route chunk. Module identity is not shared across those bundles,
 * so the result lives on `globalThis` (same anchor as the audit singleton).
 * A failed round trip stays visible until a later self-test succeeds.
 */

const AUDIT_SELF_TEST_FAILURE_KEY = Symbol.for('revealui.security.audit-self-test-failure');

interface AuditSelfTestGlobal {
  [AUDIT_SELF_TEST_FAILURE_KEY]?: string;
}

const auditSelfTestGlobal = globalThis as AuditSelfTestGlobal;

/** Record the self-test error text (no secret values). */
export function recordAuditSelfTestFailure(message: string): void {
  auditSelfTestGlobal[AUDIT_SELF_TEST_FAILURE_KEY] = message;
}

/** Clear a previous self-test failure after a successful round trip. */
export function clearAuditSelfTestFailure(): void {
  delete auditSelfTestGlobal[AUDIT_SELF_TEST_FAILURE_KEY];
}

/** The last self-test failure, or `undefined` when the last round trip succeeded. */
export function readAuditSelfTestFailure(): string | undefined {
  const value = auditSelfTestGlobal[AUDIT_SELF_TEST_FAILURE_KEY];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
