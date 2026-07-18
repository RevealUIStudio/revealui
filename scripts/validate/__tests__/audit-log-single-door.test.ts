import { describe, expect, it } from 'vitest';
import { findInsertAuditLogCalls } from '../audit-log-single-door.js';

describe('findInsertAuditLogCalls', () => {
  it('flags a direct insert(auditLog) writer', () => {
    const src = `
      await db.insert(auditLog).values({
        id,
        eventType: 'x',
        agentId: 'y',
        severity: 'info',
        payload: {},
        policyViolations: [],
      });
    `;
    const hits = findInsertAuditLogCalls(src, 'fixture.ts');
    expect(hits).toHaveLength(1);
  });

  it('flags a namespaced insert(schema.auditLog) writer', () => {
    const src = `await db.insert(schema.auditLog).values({ id });`;
    expect(findInsertAuditLogCalls(src, 'fixture.ts')).toHaveLength(1);
  });

  it('flags insert(auditLog) even without a chained .values() (partial builder)', () => {
    const src = `const q = getClient().insert(auditLog);`;
    expect(findInsertAuditLogCalls(src, 'fixture.ts')).toHaveLength(1);
  });

  it('does NOT flag a read of the audit_log table', () => {
    const src = `const rows = await db.select().from(auditLog).where(eq(auditLog.id, id));`;
    expect(findInsertAuditLogCalls(src, 'fixture.ts')).toHaveLength(0);
  });

  it('does NOT flag an insert into a different table', () => {
    const src = `await db.insert(users).values({ id, email });`;
    expect(findInsertAuditLogCalls(src, 'fixture.ts')).toHaveLength(0);
  });

  it('does NOT flag routing through the store (append is not an insert() call)', () => {
    const src = `await new DrizzleAuditStore(db).append({ id, eventType, agentId, severity, payload, policyViolations: [] });`;
    expect(findInsertAuditLogCalls(src, 'fixture.ts')).toHaveLength(0);
  });

  it('flags multiple external writers in one file', () => {
    const src = `
      await db.insert(auditLog).values({ id: a });
      await other.insert(auditLog).values({ id: b });
    `;
    expect(findInsertAuditLogCalls(src, 'fixture.ts')).toHaveLength(2);
  });
});
