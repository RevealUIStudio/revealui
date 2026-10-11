import { describe, expect, it } from 'vitest';
import { AuditWriteError } from '../audit.js';
import {
  clearAuditSelfTestFailure,
  readAuditSelfTestFailure,
  recordAuditSelfTestFailure,
} from '../audit-self-test-status.js';

describe('audit self-test failure flag', () => {
  it('records a failure and clears it after a later success', () => {
    clearAuditSelfTestFailure();
    expect(readAuditSelfTestFailure()).toBeUndefined();

    recordAuditSelfTestFailure('round trip failed');
    expect(readAuditSelfTestFailure()).toBe('round trip failed');

    clearAuditSelfTestFailure();
    expect(readAuditSelfTestFailure()).toBeUndefined();
  });
});

describe('AuditWriteError cause chain', () => {
  it('includes the nested driver message, not only the query wrapper', () => {
    const driver = new Error('function generate_series(integer, unknown) does not exist');
    const wrapped = new Error('Failed query: SELECT nextval', { cause: driver });
    const error = new AuditWriteError(
      {
        id: 'evt-1',
        timestamp: '2026-01-01T00:00:00.000Z',
        type: 'security.audit_self_test',
        severity: 'low',
        actor: { id: 'system', type: 'system' },
        action: 'audit-storage-self-test',
        result: 'success',
      },
      wrapped,
    );

    expect(error.message).toContain('Failed query: SELECT nextval');
    expect(error.message).toContain('function generate_series(integer, unknown) does not exist');
  });
});
