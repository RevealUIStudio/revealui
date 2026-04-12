/**
 * Audit System Tests
 *
 * Covers: AuditSystem, InMemoryAuditStorage, HMAC signing/verification,
 * audit middleware, AuditReportGenerator, and AuditTrail decorator.
 */

import { describe, expect, it } from 'vitest';
import {
  AuditReportGenerator,
  AuditSystem,
  createAuditMiddleware,
  InMemoryAuditStorage,
  signAuditEntry,
  verifyAuditEntry,
} from '../audit.js';

// =============================================================================
// InMemoryAuditStorage
// =============================================================================

describe('InMemoryAuditStorage', () => {
  function createEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
    return {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: 'data.read',
      severity: 'low',
      actor: { id: 'user-1', type: 'user' },
      action: 'read',
      result: 'success',
      ...overrides,
    };
  }

  it('writes and retrieves events', async () => {
    const storage = new InMemoryAuditStorage();
    const event = createEvent();

    await storage.write(event);
    const results = await storage.query({});

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(event.id);
  });

  it('trims events when maxEvents is exceeded', async () => {
    const storage = new InMemoryAuditStorage(3);

    await storage.write(createEvent({ id: 'e1' }));
    await storage.write(createEvent({ id: 'e2' }));
    await storage.write(createEvent({ id: 'e3' }));
    await storage.write(createEvent({ id: 'e4' }));

    const all = storage.getAll();
    expect(all).toHaveLength(3);
    expect(all[0].id).toBe('e2'); // e1 was trimmed
  });

  it('filters by event type', async () => {
    const storage = new InMemoryAuditStorage();
    await storage.write(createEvent({ type: 'auth.login' }));
    await storage.write(createEvent({ type: 'data.read' }));
    await storage.write(createEvent({ type: 'auth.logout' }));

    const results = await storage.query({ types: ['auth.login', 'auth.logout'] });
    expect(results).toHaveLength(2);
  });

  it('filters by actor ID', async () => {
    const storage = new InMemoryAuditStorage();
    await storage.write(createEvent({ actor: { id: 'alice', type: 'user' } }));
    await storage.write(createEvent({ actor: { id: 'bob', type: 'user' } }));

    const results = await storage.query({ actorId: 'alice' });
    expect(results).toHaveLength(1);
    expect(results[0].actor.id).toBe('alice');
  });

  it('filters by resource type and ID', async () => {
    const storage = new InMemoryAuditStorage();
    await storage.write(createEvent({ resource: { type: 'post', id: 'p1' } }));
    await storage.write(createEvent({ resource: { type: 'user', id: 'u1' } }));
    await storage.write(createEvent({ resource: { type: 'post', id: 'p2' } }));

    const byType = await storage.query({ resourceType: 'post' });
    expect(byType).toHaveLength(2);

    const byId = await storage.query({ resourceId: 'p1' });
    expect(byId).toHaveLength(1);
  });

  it('filters by date range', async () => {
    const storage = new InMemoryAuditStorage();
    await storage.write(createEvent({ timestamp: '2026-01-01T00:00:00Z' }));
    await storage.write(createEvent({ timestamp: '2026-06-15T00:00:00Z' }));
    await storage.write(createEvent({ timestamp: '2026-12-31T00:00:00Z' }));

    const results = await storage.query({
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-09-01'),
    });
    expect(results).toHaveLength(1);
  });

  it('filters by severity', async () => {
    const storage = new InMemoryAuditStorage();
    await storage.write(createEvent({ severity: 'low' }));
    await storage.write(createEvent({ severity: 'critical' }));
    await storage.write(createEvent({ severity: 'high' }));

    const results = await storage.query({ severity: ['critical', 'high'] });
    expect(results).toHaveLength(2);
  });

  it('filters by result', async () => {
    const storage = new InMemoryAuditStorage();
    await storage.write(createEvent({ result: 'success' }));
    await storage.write(createEvent({ result: 'failure' }));

    const results = await storage.query({ result: ['failure'] });
    expect(results).toHaveLength(1);
    expect(results[0].result).toBe('failure');
  });

  it('applies pagination with offset and limit', async () => {
    const storage = new InMemoryAuditStorage();
    for (let i = 0; i < 10; i++) {
      await storage.write(createEvent({ id: `e${i}` }));
    }

    const page = await storage.query({ limit: 3, offset: 2 });
    expect(page).toHaveLength(3);
  });

  it('count returns correct total ignoring pagination', async () => {
    const storage = new InMemoryAuditStorage();
    await storage.write(createEvent({ type: 'auth.login' }));
    await storage.write(createEvent({ type: 'auth.login' }));
    await storage.write(createEvent({ type: 'data.read' }));

    const count = await storage.count({ types: ['auth.login'] });
    expect(count).toBe(2);
  });

  it('clear removes all events', async () => {
    const storage = new InMemoryAuditStorage();
    await storage.write(createEvent());
    await storage.write(createEvent());

    storage.clear();
    expect(storage.getAll()).toHaveLength(0);
  });
});

// =============================================================================
// AuditSystem
// =============================================================================

describe('AuditSystem', () => {
  it('logs events with auto-generated id and timestamp', async () => {
    const storage = new InMemoryAuditStorage();
    const system = new AuditSystem(storage);

    await system.log({
      type: 'auth.login',
      severity: 'low',
      actor: { id: 'user-1', type: 'user' },
      action: 'login',
      result: 'success',
    });

    const events = await system.query({});
    expect(events).toHaveLength(1);
    expect(events[0].id).toBeDefined();
    expect(events[0].timestamp).toBeDefined();
  });

  it('applies filters and skips filtered events', async () => {
    const storage = new InMemoryAuditStorage();
    const system = new AuditSystem(storage);

    // Only log critical events
    system.addFilter((event) => event.severity === 'critical');

    await system.log({
      type: 'data.read',
      severity: 'low',
      actor: { id: 'u1', type: 'user' },
      action: 'read',
      result: 'success',
    });

    await system.log({
      type: 'security.violation',
      severity: 'critical',
      actor: { id: 'u2', type: 'user' },
      action: 'violation',
      result: 'failure',
    });

    const events = await system.query({});
    expect(events).toHaveLength(1);
    expect(events[0].severity).toBe('critical');
  });

  it('removeFilter stops filtering', async () => {
    const storage = new InMemoryAuditStorage();
    const system = new AuditSystem(storage);

    const filter = () => false; // Block everything
    system.addFilter(filter);
    await system.log({
      type: 'data.read',
      severity: 'low',
      actor: { id: 'u1', type: 'user' },
      action: 'read',
      result: 'success',
    });
    expect(await system.count({})).toBe(0);

    system.removeFilter(filter);
    await system.log({
      type: 'data.read',
      severity: 'low',
      actor: { id: 'u1', type: 'user' },
      action: 'read',
      result: 'success',
    });
    expect(await system.count({})).toBe(1);
  });

  it('logAuth sets correct severity for failures', async () => {
    const storage = new InMemoryAuditStorage();
    const system = new AuditSystem(storage);

    await system.logAuth('auth.failed_login', 'user-1', 'failure');

    const events = await system.query({});
    expect(events[0].severity).toBe('medium');
    expect(events[0].type).toBe('auth.failed_login');
  });

  it('logDataAccess sets high severity for deletes', async () => {
    const storage = new InMemoryAuditStorage();
    const system = new AuditSystem(storage);

    await system.logDataAccess('delete', 'user-1', 'post', 'p1', 'success');

    const events = await system.query({});
    expect(events[0].severity).toBe('high');
    expect(events[0].resource?.type).toBe('post');
  });

  it('logPermissionChange records permission metadata', async () => {
    const storage = new InMemoryAuditStorage();
    const system = new AuditSystem(storage);

    await system.logPermissionChange('grant', 'admin-1', 'user-2', 'admin', 'success');

    const events = await system.query({});
    expect(events[0].metadata?.permission).toBe('admin');
    expect(events[0].severity).toBe('high');
  });

  it('logSecurityEvent records message', async () => {
    const storage = new InMemoryAuditStorage();
    const system = new AuditSystem(storage);

    await system.logSecurityEvent('violation', 'critical', 'u1', 'Brute force detected');

    const events = await system.query({});
    expect(events[0].message).toBe('Brute force detected');
    expect(events[0].result).toBe('failure');
  });

  it('logGDPREvent sets high severity', async () => {
    const storage = new InMemoryAuditStorage();
    const system = new AuditSystem(storage);

    await system.logGDPREvent('data_deletion', 'user-1', 'success');

    const events = await system.query({});
    expect(events[0].type).toBe('gdpr.data_deletion');
    expect(events[0].severity).toBe('high');
  });

  it('setStorage replaces the backing store', async () => {
    const storage1 = new InMemoryAuditStorage();
    const storage2 = new InMemoryAuditStorage();
    const system = new AuditSystem(storage1);

    await system.log({
      type: 'data.read',
      severity: 'low',
      actor: { id: 'u1', type: 'user' },
      action: 'read',
      result: 'success',
    });

    system.setStorage(storage2);
    await system.log({
      type: 'data.create',
      severity: 'medium',
      actor: { id: 'u1', type: 'user' },
      action: 'create',
      result: 'success',
    });

    expect(storage1.getAll()).toHaveLength(1);
    expect(storage2.getAll()).toHaveLength(1);
  });
});

// =============================================================================
// HMAC Signing / Verification
// =============================================================================

describe('signAuditEntry / verifyAuditEntry', () => {
  const entry = {
    timestamp: '2026-04-10T00:00:00Z',
    eventType: 'data.read',
    severity: 'low',
    agentId: 'agent-1',
    payload: { key: 'value' },
  };

  it('produces a hex signature', async () => {
    const sig = await signAuditEntry(entry, 'test-secret');
    expect(sig).toHaveLength(64); // SHA-256 hex = 64 chars
  });

  it('verifies a valid signature', async () => {
    const sig = await signAuditEntry(entry, 'test-secret');
    const valid = await verifyAuditEntry(entry, sig, 'test-secret');
    expect(valid).toBe(true);
  });

  it('rejects a tampered entry', async () => {
    const sig = await signAuditEntry(entry, 'test-secret');
    const tampered = { ...entry, severity: 'critical' };
    const valid = await verifyAuditEntry(tampered, sig, 'test-secret');
    expect(valid).toBe(false);
  });

  it('rejects a wrong secret', async () => {
    const sig = await signAuditEntry(entry, 'correct-secret');
    const valid = await verifyAuditEntry(entry, sig, 'wrong-secret');
    expect(valid).toBe(false);
  });

  it('rejects a signature with wrong length', async () => {
    const valid = await verifyAuditEntry(entry, 'tooshort', 'test-secret');
    expect(valid).toBe(false);
  });

  it('is deterministic  -  same inputs produce same signature', async () => {
    const sig1 = await signAuditEntry(entry, 'secret');
    const sig2 = await signAuditEntry(entry, 'secret');
    expect(sig1).toBe(sig2);
  });
});

// =============================================================================
// Audit Middleware
// =============================================================================

describe('createAuditMiddleware', () => {
  it('logs successful requests', async () => {
    const storage = new InMemoryAuditStorage();
    const system = new AuditSystem(storage);

    const middleware = createAuditMiddleware(system, (req: { userId: string }) => ({
      id: req.userId,
    }));

    const response = { status: 200 };
    await middleware({ method: 'GET', url: '/api/data', userId: 'u1' }, async () => response);

    const events = await system.query({});
    expect(events).toHaveLength(1);
    expect(events[0].result).toBe('success');
    expect(events[0].metadata?.path).toBe('/api/data');
    expect(events[0].metadata?.status).toBe(200);
  });

  it('logs failed requests and rethrows error', async () => {
    const storage = new InMemoryAuditStorage();
    const system = new AuditSystem(storage);

    const middleware = createAuditMiddleware(system, (req: { userId: string }) => ({
      id: req.userId,
    }));

    await expect(
      middleware({ method: 'POST', url: '/api/data', userId: 'u1' }, async () => {
        throw new Error('Server error');
      }),
    ).rejects.toThrow('Server error');

    const events = await system.query({});
    expect(events).toHaveLength(1);
    expect(events[0].result).toBe('failure');
    expect(events[0].message).toBe('Server error');
  });
});

// =============================================================================
// AuditReportGenerator
// =============================================================================

describe('AuditReportGenerator', () => {
  async function createPopulatedSystem(): Promise<AuditSystem> {
    const storage = new InMemoryAuditStorage();
    const system = new AuditSystem(storage);

    await system.logAuth('auth.login', 'u1', 'success');
    await system.logAuth('auth.failed_login', 'u2', 'failure');
    await system.logAuth('auth.failed_login', 'u3', 'failure');
    await system.logDataAccess('read', 'u1', 'post', 'p1', 'success');
    await system.logDataAccess('update', 'u1', 'post', 'p1', 'success');
    await system.logDataAccess('delete', 'u1', 'post', 'p2', 'success');
    await system.logPermissionChange('grant', 'admin', 'u4', 'editor', 'success');
    await system.logSecurityEvent('violation', 'critical', 'u5', 'Injection attempt');
    await system.logGDPREvent('data_deletion', 'u1', 'success');

    return system;
  }

  it('generates security report with correct counts', async () => {
    const system = await createPopulatedSystem();
    const report = new AuditReportGenerator(system);

    const result = await report.generateSecurityReport(
      new Date('2020-01-01'),
      new Date('2030-01-01'),
    );

    expect(result.totalEvents).toBe(9);
    expect(result.failedLogins).toBe(2);
    expect(result.securityViolations).toBe(1);
    expect(result.permissionChanges).toBe(1);
    expect(result.criticalEvents).toHaveLength(1);
  });

  it('generates user activity report', async () => {
    const system = await createPopulatedSystem();
    const report = new AuditReportGenerator(system);

    const result = await report.generateUserActivityReport(
      'u1',
      new Date('2020-01-01'),
      new Date('2030-01-01'),
    );

    expect(result.totalActions).toBeGreaterThan(0);
    expect(result.failedActions).toBe(0); // u1 had no failures
  });

  it('generates compliance report', async () => {
    const system = await createPopulatedSystem();
    const report = new AuditReportGenerator(system);

    const result = await report.generateComplianceReport(
      new Date('2020-01-01'),
      new Date('2030-01-01'),
    );

    expect(result.dataAccesses).toBeGreaterThanOrEqual(1);
    expect(result.dataDeletions).toBe(1);
    expect(result.gdprRequests).toBe(1);
    expect(result.auditTrailComplete).toBe(true);
  });
});
