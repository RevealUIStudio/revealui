import { describe, expect, it, vi } from 'vitest';
import { createAuditEmitter } from '../emitter.js';
import { AuditObserver } from '../observer.js';
import { AuditPolicyEngine, builtinPolicies } from '../policy.js';
import { InMemoryAuditStore } from '../store.js';
import type { AuditEntry, AuditPolicy } from '../types.js';

function createEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    eventType: 'agent:tool:called',
    severity: 'info',
    agentId: 'agent-1',
    payload: {},
    policyViolations: [],
    ...overrides,
  };
}

async function flushAuditWork(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('audit emitter', () => {
  it('creates a frozen write-only emitter and swallows handler failures', () => {
    const handler = vi.fn();
    const emitter = createAuditEmitter('agent-1', handler);

    expect(Object.isFrozen(emitter)).toBe(true);

    emitter.emit('agent:task:started', { taskId: 'task-1' });
    expect(handler).toHaveBeenCalledWith(
      'agent-1',
      'agent:task:started',
      { taskId: 'task-1' },
      'info',
    );

    const failingEmitter = createAuditEmitter('agent-2', () => {
      throw new Error('boom');
    });
    expect(() =>
      failingEmitter.emit('agent:task:failed', { taskId: 'task-2' }, 'critical'),
    ).not.toThrow();
  });
});

describe('audit policy engine', () => {
  it('adds, evaluates, alerts, acknowledges, and removes policies', () => {
    const engine = new AuditPolicyEngine();
    const policy: AuditPolicy = {
      id: 'warn-on-tool',
      name: 'Warn on Tool Call',
      description: 'Alert on any tool call',
      severity: 'warn',
      action: 'alert',
      enabled: true,
      createdBy: 'admin',
      createdAt: new Date(),
      condition: (entry) => entry.eventType === 'agent:tool:called',
    };

    engine.addPolicy(policy);
    expect(engine.getPolicies()).toEqual([policy]);

    const result = engine.evaluate(createEntry(), []);
    expect(result.violations).toEqual(['warn-on-tool']);
    expect(result.alerts).toHaveLength(1);
    expect(result.shouldHaltAgent).toBe(false);
    expect(result.shouldHaltAll).toBe(false);

    const alertId = result.alerts[0]?.id;
    expect(engine.getAlerts()).toHaveLength(1);
    expect(engine.getAlerts(true)).toHaveLength(1);
    expect(engine.acknowledgeAlert(alertId ?? '', 'reviewer')).toBe(true);
    expect(engine.getAlerts(true)).toHaveLength(0);

    engine.removePolicy(policy.id);
    expect(engine.getPolicies()).toEqual([]);
  });

  it('exercises builtin policies for alert, halt-agent, and halt-all paths', () => {
    const engine = new AuditPolicyEngine();
    const createdBy = 'admin';
    engine.addPolicy(builtinPolicies.toolCallRateLimit(2, createdBy));
    engine.addPolicy(builtinPolicies.selfModificationBlock(createdBy));
    engine.addPolicy(builtinPolicies.consecutiveFailures(2, createdBy));
    engine.addPolicy(builtinPolicies.deniedToolAccess(createdBy));
    engine.addPolicy(builtinPolicies.fleetMemoryFlood(2, createdBy));

    const recentToolCalls = [
      createEntry({ eventType: 'agent:tool:called' }),
      createEntry({ eventType: 'agent:tool:called' }),
    ];
    const toolResult = engine.evaluate(
      createEntry({ eventType: 'agent:tool:called' }),
      recentToolCalls,
    );
    expect(toolResult.violations).toContain('builtin:tool-call-rate-limit');

    const selfModifyResult = engine.evaluate(
      createEntry({
        payload: { toolName: 'modify_spec', arguments: 'self_modify' },
      }),
      [],
    );
    expect(selfModifyResult.shouldHaltAgent).toBe(true);

    const failureHistory = [
      createEntry({ eventType: 'agent:task:failed' }),
      createEntry({ eventType: 'agent:task:failed' }),
    ];
    const failureResult = engine.evaluate(
      createEntry({ eventType: 'agent:task:failed' }),
      failureHistory,
    );
    expect(failureResult.violations).toContain('builtin:consecutive-failures');

    const deniedResult = engine.evaluate(createEntry({ eventType: 'agent:tool:denied' }), []);
    expect(deniedResult.shouldHaltAgent).toBe(true);

    const recentWrites = [
      createEntry({ eventType: 'agent:memory:write' }),
      createEntry({ eventType: 'agent:memory:write' }),
    ];
    const floodResult = engine.evaluate(
      createEntry({ eventType: 'agent:memory:write' }),
      recentWrites,
    );
    expect(floodResult.shouldHaltAll).toBe(true);
  });
});

describe('in-memory audit store', () => {
  it('appends, batches, queries, counts, limits, and returns recent entries', async () => {
    const store = new InMemoryAuditStore(2);
    const first = createEntry({
      id: 'entry-1',
      agentId: 'agent-1',
      taskId: 'task-1',
      sessionId: 'session-1',
      severity: 'info',
    });
    const second = createEntry({
      id: 'entry-2',
      agentId: 'agent-2',
      taskId: 'task-2',
      sessionId: 'session-2',
      severity: 'warn',
      eventType: 'agent:task:failed',
    });
    const third = createEntry({
      id: 'entry-3',
      agentId: 'agent-1',
      taskId: 'task-3',
      sessionId: 'session-3',
      severity: 'critical',
      eventType: 'agent:tool:denied',
    });

    await store.append(first);
    await store.appendBatch([second, third]);

    expect(await store.count()).toBe(2);
    expect(await store.count('agent-1')).toBe(1);

    await expect(
      store.query({
        agentId: 'agent-1',
        severity: ['critical'],
        eventTypes: ['agent:tool:denied'],
      }),
    ).resolves.toEqual([third]);

    await expect(store.query({ offset: 1, limit: 1 })).resolves.toEqual([second]);
    await expect(store.since(new Date(0), 10)).resolves.toEqual([second, third]);
  });
});

describe('audit observer', () => {
  it('emits events, raises alerts, halts agents, manages fleet state, and exposes queries', async () => {
    const store = new InMemoryAuditStore();
    const onAlert = vi.fn();
    const onAgentHalted = vi.fn();
    const onFleetHalted = vi.fn();
    const observer = new AuditObserver({
      store,
      onAlert,
      onAgentHalted,
      onFleetHalted,
      recentHistorySize: 2,
    });

    observer.addPolicy({
      id: 'halt-on-denied',
      name: 'Halt on denied tool',
      description: 'Stop agents that hit denied tools',
      severity: 'critical',
      action: 'halt_agent',
      enabled: true,
      createdBy: 'admin',
      createdAt: new Date(),
      condition: (entry) => entry.eventType === 'agent:tool:denied',
    });

    const emitter = observer.createEmitterForAgent('agent-1');
    emitter.emit('agent:tool:called', { toolName: 'search' });
    emitter.emit('agent:tool:denied', { toolName: 'dangerous-tool' }, 'warn');
    await flushAuditWork();

    expect(onAlert).toHaveBeenCalled();
    expect(onAgentHalted).toHaveBeenCalledWith('agent-1', 'Policy violation: halt-on-denied');
    expect(observer.isAgentHalted('agent-1')).toBe(true);
    expect(observer.getAgentStatus('agent-1')).toMatchObject({
      halted: true,
      totalEvents: 2,
      totalViolations: 1,
    });
    expect(await observer.getTotalEntries()).toBeGreaterThanOrEqual(4);

    const criticalEntries = await observer.query({ severity: ['critical'] });
    expect(criticalEntries.some((entry) => entry.eventType === 'human:agent:halted')).toBe(true);

    const alert = observer.getAlerts()[0];
    expect(alert).toBeDefined();
    expect(observer.acknowledgeAlert(alert?.id ?? '', 'reviewer')).toBe(true);
    await flushAuditWork();
    expect(observer.getAlerts(true)).toHaveLength(0);

    observer.resumeAgent('agent-1', 'admin');
    observer.haltFleet('admin', 'Emergency stop');
    await flushAuditWork();
    expect(observer.isFleetHalted()).toBe(true);
    expect(onFleetHalted).toHaveBeenCalledWith('Emergency stop');

    observer.resumeFleet('admin');
    await flushAuditWork();
    expect(observer.isFleetHalted()).toBe(false);

    observer.removePolicy('halt-on-denied', 'admin');
    await flushAuditWork();
    expect(observer.getPolicies()).toEqual([]);
    expect(observer.getAgentStatuses()).toHaveLength(1);
  });

  it('drops events from halted agents and from a halted fleet', async () => {
    const store = new InMemoryAuditStore();
    const observer = new AuditObserver({ store });
    const emitter = observer.createEmitterForAgent('agent-2');

    observer.haltAgent('agent-2', 'admin', 'Manual stop');
    await flushAuditWork();
    const countAfterHalt = await observer.getTotalEntries();

    emitter.emit('agent:task:started', { taskId: 'blocked-task' });
    await flushAuditWork();
    expect(await observer.getTotalEntries()).toBe(countAfterHalt);

    observer.resumeAgent('agent-2', 'admin');
    observer.haltFleet('admin', 'Fleet stop');
    await flushAuditWork();
    const countAfterFleetHalt = await observer.getTotalEntries();

    emitter.emit('agent:task:started', { taskId: 'fleet-blocked-task' });
    await flushAuditWork();
    expect(await observer.getTotalEntries()).toBe(countAfterFleetHalt);
  });
});
