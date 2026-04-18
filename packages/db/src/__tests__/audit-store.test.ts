import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type AuditEntry, DrizzleAuditStore } from '../audit-store.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id: 'e1',
    timestamp: new Date('2026-01-01T00:00:00Z'),
    eventType: 'agent:task:started',
    severity: 'info',
    agentId: 'agent-1',
    payload: { task: 'test' },
    policyViolations: [],
    ...overrides,
  };
}

function createMockDb() {
  const insertChain = {
    values: vi.fn().mockResolvedValue(undefined),
  };
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockResolvedValue([]),
  };
  const countChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([{ value: 0 }]),
  };

  return {
    insert: vi.fn().mockReturnValue(insertChain),
    select: vi.fn().mockReturnValue(selectChain),
    update: vi.fn(),
    delete: vi.fn(),
    _insertChain: insertChain,
    _selectChain: selectChain,
    _countChain: countChain,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DrizzleAuditStore  -  append-only enforcement', () => {
  let db: ReturnType<typeof createMockDb>;
  let store: DrizzleAuditStore;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createMockDb();
    store = new DrizzleAuditStore(db as never);
  });

  // ── Interface surface ─────────────────────────────────────────────────────

  it('exposes only append/query operations (no update or delete methods)', () => {
    expect(typeof store.append).toBe('function');
    expect(typeof store.appendBatch).toBe('function');
    expect(typeof store.query).toBe('function');
    expect(typeof store.count).toBe('function');
    expect(typeof store.since).toBe('function');
    // Must NOT expose mutating operations
    expect((store as Record<string, unknown>).update).toBeUndefined();
    expect((store as Record<string, unknown>).delete).toBeUndefined();
    expect((store as Record<string, unknown>).remove).toBeUndefined();
  });

  // ── append() ─────────────────────────────────────────────────────────────

  it('append() calls db.insert  -  never db.update or db.delete', async () => {
    await store.append(makeEntry());

    expect(db.insert).toHaveBeenCalledOnce();
    expect(db.update).not.toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
  });

  it('append() passes all required fields to insert', async () => {
    const entry = makeEntry({ taskId: 't1', sessionId: 's1' });
    await store.append(entry);

    const values = db._insertChain.values.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(values).toMatchObject({
      id: 'e1',
      eventType: 'agent:task:started',
      severity: 'info',
      agentId: 'agent-1',
      taskId: 't1',
      sessionId: 's1',
    });
  });

  it('append() sets null for optional taskId/sessionId when absent', async () => {
    await store.append(makeEntry());

    const values = db._insertChain.values.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(values.taskId).toBeNull();
    expect(values.sessionId).toBeNull();
  });

  // ── appendBatch() ─────────────────────────────────────────────────────────

  it('appendBatch() calls db.insert once for a non-empty batch', async () => {
    await store.appendBatch([makeEntry({ id: 'e1' }), makeEntry({ id: 'e2' })]);

    expect(db.insert).toHaveBeenCalledOnce();
    expect(db.update).not.toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
  });

  it('appendBatch() does nothing for empty array', async () => {
    await store.appendBatch([]);

    expect(db.insert).not.toHaveBeenCalled();
  });

  it('appendBatch() passes all entries to values()', async () => {
    const entries = [makeEntry({ id: 'e1' }), makeEntry({ id: 'e2' })];
    await store.appendBatch(entries);

    const batchValues = db._insertChain.values.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
    expect(batchValues).toHaveLength(2);
    expect(batchValues[0]?.id).toBe('e1');
    expect(batchValues[1]?.id).toBe('e2');
  });

  // ── DB-level trigger (migration verification) ─────────────────────────────

  it('migration SQL contains append-only trigger for audit_log', async () => {
    // Read the migration file and assert the trigger is present.
    // This is a static check  -  if someone removes the trigger from the migration,
    // this test catches it before it ships.
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const { fileURLToPath } = await import('node:url');

    const dir = fileURLToPath(new URL('../../migrations', import.meta.url));
    const sql = readFileSync(resolve(dir, '0002_triggers_search_vectors.sql'), 'utf8');

    expect(sql).toContain('prevent_audit_log_modification');
    expect(sql).toContain('BEFORE UPDATE OR DELETE ON "audit_log"');
    expect(sql).toContain("RAISE EXCEPTION 'audit_log is append-only");
  });
});
