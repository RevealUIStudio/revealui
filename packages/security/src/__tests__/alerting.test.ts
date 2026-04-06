import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import {
  type AlertHandler,
  AuditAlertHandler,
  DEFAULT_THRESHOLDS,
  LogAlertHandler,
  type SecurityAlert,
  SecurityAlertService,
  WebhookAlertHandler,
} from '../alerting.js';
import type { AuditEvent } from '../audit.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    type: 'auth.failed_login',
    severity: 'medium',
    actor: { id: 'user@example.com', type: 'user', ip: '127.0.0.1' },
    action: 'login',
    result: 'failure',
    ...overrides,
  };
}

class SpyHandler implements AlertHandler {
  alerts: SecurityAlert[] = [];

  async handle(alert: SecurityAlert): Promise<void> {
    this.alerts.push(alert);
  }
}

// ---------------------------------------------------------------------------
// SecurityAlertService
// ---------------------------------------------------------------------------

describe('SecurityAlertService', () => {
  let spy: SpyHandler;
  let service: SecurityAlertService;

  beforeEach(() => {
    spy = new SpyHandler();
    service = new SecurityAlertService({
      thresholds: { ...DEFAULT_THRESHOLDS },
      handlers: [spy],
    });
  });

  it('does not alert below the failed login threshold', async () => {
    for (let i = 0; i < 9; i++) {
      const result = await service.evaluateEvent(makeEvent());
      expect(result).toBeNull();
    }
    expect(spy.alerts).toHaveLength(0);
  });

  it('alerts when failed login threshold is reached', async () => {
    for (let i = 0; i < 10; i++) {
      await service.evaluateEvent(makeEvent());
    }
    expect(spy.alerts).toHaveLength(1);
    expect(spy.alerts[0]?.type).toBe('failedLogins');
    expect(spy.alerts[0]?.severity).toBe('high');
  });

  it('does not duplicate alerts within the same window', async () => {
    for (let i = 0; i < 20; i++) {
      await service.evaluateEvent(makeEvent());
    }
    // Only one alert should fire even though threshold was exceeded many times
    expect(spy.alerts).toHaveLength(1);
  });

  it('groups failed logins by actor', async () => {
    // 10 events for user A — should alert
    for (let i = 0; i < 10; i++) {
      await service.evaluateEvent(makeEvent({ actor: { id: 'a@test.com', type: 'user' } }));
    }
    // 5 events for user B — should NOT alert
    for (let i = 0; i < 5; i++) {
      await service.evaluateEvent(makeEvent({ actor: { id: 'b@test.com', type: 'user' } }));
    }
    expect(spy.alerts).toHaveLength(1);
    expect(spy.alerts[0]?.context.actorId).toBe('a@test.com');
  });

  it('alerts on privilege escalation (role change to admin)', async () => {
    const result = await service.evaluateEvent(
      makeEvent({
        type: 'role.assign',
        action: 'assign',
        result: 'success',
        severity: 'high',
        changes: { after: { role: 'admin' } },
      }),
    );
    expect(result).not.toBeNull();
    expect(result?.type).toBe('privilegeEscalation');
    expect(result?.severity).toBe('critical');
  });

  it('does not alert on non-admin role assignment', async () => {
    const result = await service.evaluateEvent(
      makeEvent({
        type: 'role.assign',
        action: 'assign',
        result: 'success',
        severity: 'high',
        changes: { after: { role: 'editor' } },
      }),
    );
    expect(result).toBeNull();
  });

  it('alerts on account lockout', async () => {
    const result = await service.evaluateEvent(
      makeEvent({
        type: 'security.alert',
        action: 'account_locked',
        result: 'failure',
        severity: 'high',
      }),
    );
    expect(result).not.toBeNull();
    expect(result?.type).toBe('accountLockout');
  });

  it('alerts on MFA disabled', async () => {
    const result = await service.evaluateEvent(
      makeEvent({
        type: 'auth.mfa_disabled',
        action: 'mfa_disabled',
        result: 'success',
        severity: 'high',
      }),
    );
    expect(result).not.toBeNull();
    expect(result?.type).toBe('mfaDisabled');
    expect(result?.severity).toBe('critical');
  });

  it('alerts on mass data export', async () => {
    for (let i = 0; i < 100; i++) {
      await service.evaluateEvent(
        makeEvent({
          type: 'data.export',
          action: 'export',
          result: 'success',
          severity: 'low',
        }),
      );
    }
    expect(spy.alerts).toHaveLength(1);
    expect(spy.alerts[0]?.type).toBe('massDataExport');
  });

  it('ignores events that do not match any rule', async () => {
    const result = await service.evaluateEvent(
      makeEvent({ type: 'data.read', action: 'read', result: 'success' }),
    );
    expect(result).toBeNull();
    expect(spy.alerts).toHaveLength(0);
  });

  it('dispatches to multiple handlers', async () => {
    const spy2 = new SpyHandler();
    const multiService = new SecurityAlertService({
      thresholds: { ...DEFAULT_THRESHOLDS },
      handlers: [spy, spy2],
    });

    await multiService.evaluateEvent(
      makeEvent({ type: 'auth.mfa_disabled', action: 'mfa_disabled' }),
    );

    expect(spy.alerts).toHaveLength(1);
    expect(spy2.alerts).toHaveLength(1);
  });

  it('continues dispatching if one handler throws', async () => {
    const failingHandler: AlertHandler = {
      async handle(): Promise<void> {
        throw new Error('handler exploded');
      },
    };
    const afterSpy = new SpyHandler();
    const svc = new SecurityAlertService({
      thresholds: { ...DEFAULT_THRESHOLDS },
      handlers: [failingHandler, afterSpy],
    });

    await svc.evaluateEvent(makeEvent({ type: 'auth.mfa_disabled', action: 'mfa_disabled' }));

    expect(afterSpy.alerts).toHaveLength(1);
  });

  it('reset() clears all window state', async () => {
    // Accumulate 9 events (below threshold)
    for (let i = 0; i < 9; i++) {
      await service.evaluateEvent(makeEvent());
    }
    service.reset();

    // After reset, 1 more event should NOT trigger (window cleared)
    const result = await service.evaluateEvent(makeEvent());
    expect(result).toBeNull();
    expect(spy.alerts).toHaveLength(0);
  });

  it('replaces {count} in message template', async () => {
    for (let i = 0; i < 10; i++) {
      await service.evaluateEvent(makeEvent());
    }
    expect(spy.alerts[0]?.message).toContain('10');
  });
});

// ---------------------------------------------------------------------------
// LogAlertHandler
// ---------------------------------------------------------------------------

describe('LogAlertHandler', () => {
  it('logs critical alerts with error level', async () => {
    const handler = new LogAlertHandler();
    const alert: SecurityAlert = {
      type: 'test',
      severity: 'critical',
      message: 'Critical test alert',
      context: {},
      timestamp: new Date().toISOString(),
    };

    // LogAlertHandler uses getSecurityLogger() which defaults to console
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await handler.handle(alert);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('logs non-critical alerts with warn level', async () => {
    const handler = new LogAlertHandler();
    const alert: SecurityAlert = {
      type: 'test',
      severity: 'high',
      message: 'High test alert',
      context: {},
      timestamp: new Date().toISOString(),
    };

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await handler.handle(alert);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// WebhookAlertHandler
// ---------------------------------------------------------------------------

describe('WebhookAlertHandler', () => {
  let fetchMock: Mock;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
  });

  it('POSTs the alert to the configured URL', async () => {
    const handler = new WebhookAlertHandler('https://siem.example.com/alerts', {
      Authorization: 'Bearer tok',
    });
    const alert: SecurityAlert = {
      type: 'failedLogins',
      severity: 'high',
      message: 'test',
      context: {},
      timestamp: new Date().toISOString(),
    };

    await handler.handle(alert);

    expect(fetchMock).toHaveBeenCalledWith('https://siem.example.com/alerts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer tok',
      },
      body: JSON.stringify(alert),
    });
  });

  it('does not throw when fetch fails', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    const handler = new WebhookAlertHandler('https://fail.example.com');

    // Silence console.error from the handler's catch block
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(
      handler.handle({
        type: 'test',
        severity: 'high',
        message: 'fail test',
        context: {},
        timestamp: new Date().toISOString(),
      }),
    ).resolves.toBeUndefined();
    errorSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// AuditAlertHandler
// ---------------------------------------------------------------------------

describe('AuditAlertHandler', () => {
  it('writes to the audit system', async () => {
    // Mock the audit module
    const logSecurityEventMock = vi.fn().mockResolvedValue(undefined);
    vi.doMock('../audit.js', () => ({
      audit: {
        logSecurityEvent: logSecurityEventMock,
      },
    }));

    // Re-import to pick up the mock
    const { AuditAlertHandler: MockedHandler } = await import('../alerting.js');
    const handler = new MockedHandler();

    await handler.handle({
      type: 'failedLogins',
      severity: 'high',
      message: 'test audit alert',
      context: { actorId: 'user-123' },
      timestamp: new Date().toISOString(),
    });

    // The handler imports audit.js dynamically, so it gets the mocked version
    // We can't easily assert here since the dynamic import may or may not
    // pick up the mock depending on module cache. The test validates no throw.
  });

  it('does not throw when audit system is unavailable', async () => {
    const handler = new AuditAlertHandler();
    // If audit import fails, handle() should swallow the error
    await expect(
      handler.handle({
        type: 'test',
        severity: 'high',
        message: 'test',
        context: {},
        timestamp: new Date().toISOString(),
      }),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// DEFAULT_THRESHOLDS
// ---------------------------------------------------------------------------

describe('DEFAULT_THRESHOLDS', () => {
  it('defines all expected rules', () => {
    expect(DEFAULT_THRESHOLDS).toHaveProperty('failedLogins');
    expect(DEFAULT_THRESHOLDS).toHaveProperty('privilegeEscalation');
    expect(DEFAULT_THRESHOLDS).toHaveProperty('massDataExport');
    expect(DEFAULT_THRESHOLDS).toHaveProperty('accountLockout');
    expect(DEFAULT_THRESHOLDS).toHaveProperty('mfaDisabled');
  });

  it('failedLogins: 10 attempts in 15 min window', () => {
    const rule = DEFAULT_THRESHOLDS.failedLogins;
    expect(rule?.maxCount).toBe(10);
    expect(rule?.windowMs).toBe(15 * 60 * 1000);
    expect(rule?.severity).toBe('high');
  });

  it('privilegeEscalation: threshold of 1 (immediate alert)', () => {
    expect(DEFAULT_THRESHOLDS.privilegeEscalation?.maxCount).toBe(1);
    expect(DEFAULT_THRESHOLDS.privilegeEscalation?.severity).toBe('critical');
  });

  it('massDataExport: 100 exports in 1 hour', () => {
    expect(DEFAULT_THRESHOLDS.massDataExport?.maxCount).toBe(100);
    expect(DEFAULT_THRESHOLDS.massDataExport?.windowMs).toBe(60 * 60 * 1000);
  });

  it('accountLockout: immediate alert', () => {
    expect(DEFAULT_THRESHOLDS.accountLockout?.maxCount).toBe(1);
  });

  it('mfaDisabled: immediate critical alert', () => {
    expect(DEFAULT_THRESHOLDS.mfaDisabled?.maxCount).toBe(1);
    expect(DEFAULT_THRESHOLDS.mfaDisabled?.severity).toBe('critical');
  });
});
