import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type AuditEvent,
  AuditReportGenerator,
  type AuditStorage,
  AuditSystem,
  createAuditMiddleware,
  InMemoryAuditStorage,
} from '../../security/audit.js';

function createMockStorage(): AuditStorage & { events: AuditEvent[] } {
  const events: AuditEvent[] = [];
  return {
    events,
    write: vi.fn(async (event: AuditEvent) => {
      events.push(event);
    }),
    query: vi.fn(async () => events),
    count: vi.fn(async () => events.length),
  };
}

describe('AuditSystem', () => {
  let storage: ReturnType<typeof createMockStorage>;
  let audit: AuditSystem;

  beforeEach(() => {
    storage = createMockStorage();
    audit = new AuditSystem(storage);
  });

  describe('log', () => {
    it('writes event with generated id and timestamp', async () => {
      await audit.log({
        type: 'auth.login',
        severity: 'low',
        actor: { id: 'user1', type: 'user' },
        action: 'login',
        result: 'success',
      });

      expect(storage.write).toHaveBeenCalledOnce();
      const event = (storage.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as AuditEvent;
      expect(event.id).toBeTruthy();
      expect(event.timestamp).toBeTruthy();
      expect(event.type).toBe('auth.login');
    });

    it('respects filters — blocks event when filter returns false', async () => {
      audit.addFilter(() => false);

      await audit.log({
        type: 'auth.login',
        severity: 'low',
        actor: { id: 'user1', type: 'user' },
        action: 'login',
        result: 'success',
      });

      expect(storage.write).not.toHaveBeenCalled();
    });

    it('passes event when all filters return true', async () => {
      audit.addFilter(() => true);
      audit.addFilter(() => true);

      await audit.log({
        type: 'auth.login',
        severity: 'low',
        actor: { id: 'user1', type: 'user' },
        action: 'login',
        result: 'success',
      });

      expect(storage.write).toHaveBeenCalledOnce();
    });
  });

  describe('logAuth', () => {
    it('sets severity to medium on failure', async () => {
      await audit.logAuth('auth.failed_login', 'user1', 'failure');

      const event = (storage.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as AuditEvent;
      expect(event.severity).toBe('medium');
      expect(event.type).toBe('auth.failed_login');
    });

    it('sets severity to low on success', async () => {
      await audit.logAuth('auth.login', 'user1', 'success');

      const event = (storage.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as AuditEvent;
      expect(event.severity).toBe('low');
    });
  });

  describe('logDataAccess', () => {
    it('sets severity to high for delete actions', async () => {
      await audit.logDataAccess('delete', 'user1', 'post', 'p1', 'success');

      const event = (storage.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as AuditEvent;
      expect(event.severity).toBe('high');
      expect(event.resource).toEqual({ type: 'post', id: 'p1' });
    });

    it('sets severity to medium for non-delete actions', async () => {
      await audit.logDataAccess('read', 'user1', 'post', 'p1', 'success');

      const event = (storage.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as AuditEvent;
      expect(event.severity).toBe('medium');
    });

    it('includes changes when provided', async () => {
      const changes = { before: { title: 'old' }, after: { title: 'new' } };
      await audit.logDataAccess('update', 'user1', 'post', 'p1', 'success', changes);

      const event = (storage.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as AuditEvent;
      expect(event.changes).toEqual(changes);
    });
  });

  describe('logPermissionChange', () => {
    it('logs permission grant with high severity', async () => {
      await audit.logPermissionChange('grant', 'admin1', 'user2', 'write:posts', 'success');

      const event = (storage.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as AuditEvent;
      expect(event.severity).toBe('high');
      expect(event.metadata).toEqual({ permission: 'write:posts' });
    });
  });

  describe('logSecurityEvent', () => {
    it('logs with provided severity and result=failure', async () => {
      await audit.logSecurityEvent('violation', 'critical', 'user1', 'SQL injection attempt');

      const event = (storage.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as AuditEvent;
      expect(event.severity).toBe('critical');
      expect(event.result).toBe('failure');
      expect(event.message).toBe('SQL injection attempt');
    });
  });

  describe('logGDPREvent', () => {
    it('logs GDPR event with high severity', async () => {
      await audit.logGDPREvent('data_deletion', 'user1', 'success', { reason: 'request' });

      const event = (storage.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as AuditEvent;
      expect(event.type).toBe('gdpr.data_deletion');
      expect(event.severity).toBe('high');
    });
  });

  describe('filter management', () => {
    it('removeFilter removes previously added filter', async () => {
      const blockAll = () => false;
      audit.addFilter(blockAll);
      audit.removeFilter(blockAll);

      await audit.log({
        type: 'auth.login',
        severity: 'low',
        actor: { id: 'user1', type: 'user' },
        action: 'login',
        result: 'success',
      });

      expect(storage.write).toHaveBeenCalledOnce();
    });

    it('removeFilter does nothing if filter not found', () => {
      audit.removeFilter(() => true);
      // No error thrown
    });
  });

  describe('query and count', () => {
    it('delegates to storage', async () => {
      const query = { types: ['auth.login' as const] };
      await audit.query(query);
      expect(storage.query).toHaveBeenCalledWith(query);

      await audit.count(query);
      expect(storage.count).toHaveBeenCalledWith(query);
    });
  });
});

describe('InMemoryAuditStorage', () => {
  let store: InMemoryAuditStorage;

  const makeEvent = (overrides: Partial<AuditEvent> = {}): AuditEvent => ({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    type: 'auth.login',
    severity: 'low',
    actor: { id: 'user1', type: 'user' },
    action: 'login',
    result: 'success',
    ...overrides,
  });

  beforeEach(() => {
    store = new InMemoryAuditStorage();
  });

  it('writes and retrieves events', async () => {
    const event = makeEvent();
    await store.write(event);

    const results = await store.query({});
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe(event.id);
  });

  it('trims events beyond maxEvents', async () => {
    const small = new InMemoryAuditStorage(3);
    for (let i = 0; i < 5; i++) {
      await small.write(makeEvent({ id: `evt-${i}` }));
    }

    const all = small.getAll();
    expect(all).toHaveLength(3);
    expect(all[0]?.id).toBe('evt-2');
  });

  it('filters by type', async () => {
    await store.write(makeEvent({ type: 'auth.login' }));
    await store.write(makeEvent({ type: 'auth.logout' }));

    const results = await store.query({ types: ['auth.login'] });
    expect(results).toHaveLength(1);
  });

  it('filters by actorId', async () => {
    await store.write(makeEvent({ actor: { id: 'u1', type: 'user' } }));
    await store.write(makeEvent({ actor: { id: 'u2', type: 'user' } }));

    const results = await store.query({ actorId: 'u1' });
    expect(results).toHaveLength(1);
  });

  it('filters by severity', async () => {
    await store.write(makeEvent({ severity: 'low' }));
    await store.write(makeEvent({ severity: 'critical' }));

    const results = await store.query({ severity: ['critical'] });
    expect(results).toHaveLength(1);
  });

  it('filters by result', async () => {
    await store.write(makeEvent({ result: 'success' }));
    await store.write(makeEvent({ result: 'failure' }));

    const results = await store.query({ result: ['failure'] });
    expect(results).toHaveLength(1);
  });

  it('filters by date range', async () => {
    const old = makeEvent({ timestamp: '2020-01-01T00:00:00Z' });
    const recent = makeEvent({ timestamp: '2025-06-01T00:00:00Z' });
    await store.write(old);
    await store.write(recent);

    const results = await store.query({ startDate: new Date('2025-01-01') });
    expect(results).toHaveLength(1);
  });

  it('applies pagination', async () => {
    for (let i = 0; i < 10; i++) {
      await store.write(makeEvent({ id: `evt-${i}` }));
    }

    const page = await store.query({ limit: 3, offset: 2 });
    expect(page).toHaveLength(3);
  });

  it('count returns total matching events', async () => {
    for (let i = 0; i < 5; i++) {
      await store.write(makeEvent());
    }

    const count = await store.count({});
    expect(count).toBe(5);
  });

  it('clear removes all events', async () => {
    await store.write(makeEvent());
    store.clear();
    expect(store.getAll()).toHaveLength(0);
  });
});

describe('createAuditMiddleware', () => {
  it('logs successful request', async () => {
    const storage = createMockStorage();
    const audit = new AuditSystem(storage);
    const getUser = () => ({ id: 'u1', ip: '1.2.3.4' });
    const middleware = createAuditMiddleware(audit, getUser);

    const request = { method: 'GET', url: '/api/posts' };
    const response = { status: 200 };
    const next = vi.fn(async () => response);

    const result = await middleware(request, next);

    expect(result).toBe(response);
    expect(storage.write).toHaveBeenCalledOnce();
    const event = (storage.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as AuditEvent;
    expect(event.result).toBe('success');
    expect(event.metadata).toMatchObject({ path: '/api/posts' });
  });

  it('logs failed request and rethrows', async () => {
    const storage = createMockStorage();
    const audit = new AuditSystem(storage);
    const getUser = () => ({ id: 'u1' });
    const middleware = createAuditMiddleware(audit, getUser);

    const request = { method: 'POST', url: '/api/data' };
    const next = vi.fn(async () => {
      throw new Error('DB error');
    });

    await expect(middleware(request, next as never)).rejects.toThrow('DB error');
    expect(storage.write).toHaveBeenCalledOnce();
    const event = (storage.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as AuditEvent;
    expect(event.result).toBe('failure');
    expect(event.message).toBe('DB error');
  });
});

describe('AuditReportGenerator', () => {
  let storage: InMemoryAuditStorage;
  let audit: AuditSystem;
  let generator: AuditReportGenerator;

  beforeEach(() => {
    storage = new InMemoryAuditStorage();
    audit = new AuditSystem(storage);
    generator = new AuditReportGenerator(audit);
  });

  it('generates security report', async () => {
    await audit.logAuth('auth.failed_login', 'u1', 'failure');
    await audit.logSecurityEvent('violation', 'critical', 'u1', 'XSS attempt');
    await audit.logPermissionChange('grant', 'admin', 'u2', 'write', 'success');

    const report = await generator.generateSecurityReport(
      new Date('2020-01-01'),
      new Date('2030-01-01'),
    );

    expect(report.totalEvents).toBe(3);
    expect(report.securityViolations).toBe(1);
    expect(report.failedLogins).toBe(1);
    expect(report.permissionChanges).toBe(1);
    expect(report.criticalEvents).toHaveLength(1);
  });

  it('generates user activity report', async () => {
    await audit.logAuth('auth.login', 'u1', 'success');
    await audit.logDataAccess('read', 'u1', 'post', 'p1', 'success');
    await audit.logDataAccess('update', 'u1', 'post', 'p1', 'failure');

    const report = await generator.generateUserActivityReport(
      'u1',
      new Date('2020-01-01'),
      new Date('2030-01-01'),
    );

    expect(report.totalActions).toBe(3);
    expect(report.failedActions).toBe(1);
    expect(report.recentActions.length).toBeLessThanOrEqual(10);
  });

  it('generates compliance report', async () => {
    await audit.logDataAccess('read', 'u1', 'post', 'p1', 'success');
    await audit.logDataAccess('create', 'u1', 'post', 'p2', 'success');
    await audit.logDataAccess('delete', 'u1', 'post', 'p3', 'success');
    await audit.logGDPREvent('data_request', 'u1', 'success');

    const report = await generator.generateComplianceReport(
      new Date('2020-01-01'),
      new Date('2030-01-01'),
    );

    expect(report.dataAccesses).toBe(1);
    expect(report.dataModifications).toBe(1);
    expect(report.dataDeletions).toBe(1);
    expect(report.gdprRequests).toBe(1);
    expect(report.auditTrailComplete).toBe(true);
  });
});
