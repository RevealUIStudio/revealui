import { LLM_CHAT_METER_NAME } from '@revealui/core/ai-runtime-guards';
import type { Database } from '@revealui/db/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  enforceAdminChatRails,
  estimateLlmCostMicros,
  loadAdminChatAccountContext,
  recordAdminChatCall,
} from '../chat-cost-rails';

vi.mock('@revealui/core/license', () => ({
  getMaxAgentTasks: vi.fn(() => 10_000),
}));

vi.mock('@revealui/config/stripe-mode', () => ({
  getConfiguredStripeMode: () => 'test',
}));

const resolveActiveMembership = vi.fn();
vi.mock('@/lib/access/resolve-membership', () => ({
  resolveActiveMembership: (...args: unknown[]) => resolveActiveMembership(...args),
}));

function responseStatus(value: unknown): number | null {
  if (value && typeof value === 'object' && 'status' in value) {
    return (value as { status: number }).status;
  }
  return null;
}

async function responseJson(value: unknown): Promise<Record<string, unknown>> {
  if (value && typeof value === 'object' && 'json' in value) {
    return (value as { json: () => Promise<Record<string, unknown>> }).json();
  }
  return {};
}

function context(
  overrides?: Partial<{
    accountId: string | null;
    tier: string;
    quota: number;
    alreadyTripped: boolean;
    costCents: number;
  }>,
) {
  return {
    accountId: 'acct-1',
    tier: 'pro',
    quota: 10_000,
    alreadyTripped: false,
    costCents: 0,
    ...overrides,
  };
}

describe('enforceAdminChatRails', () => {
  const env = {} as NodeJS.ProcessEnv;
  const db = {} as Database;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.REVEALUI_AI_DISABLED;
  });

  it('returns 503 when the kill switch is set', async () => {
    const loadContext = vi.fn();
    const result = await enforceAdminChatRails({
      userId: 'user-1',
      db,
      env: { REVEALUI_AI_DISABLED: 'true' },
      loadContext,
    });
    expect(responseStatus(result)).toBe(503);
    expect(await responseJson(result)).toMatchObject({ code: 'AI_DISABLED' });
    expect(loadContext).not.toHaveBeenCalled();
  });

  it('returns 429 when the shared monthly quota is exceeded', async () => {
    const result = await enforceAdminChatRails({
      userId: 'user-1',
      db,
      env,
      loadContext: async () => context({ quota: 10 }),
      admit: async () => ({
        admitted: false,
        reason: 'quota',
        used: 10,
        quota: 10,
        resetAt: '2026-11-01T00:00:00.000Z',
      }),
    });
    expect(responseStatus(result)).toBe(429);
    expect(await responseJson(result)).toMatchObject({
      code: 'TASK_QUOTA_EXCEEDED',
      used: 10,
      quota: 10,
    });
  });

  it('returns 503 when the COGS breaker is already tripped for a free account', async () => {
    const admit = vi.fn();
    const result = await enforceAdminChatRails({
      userId: 'user-1',
      db,
      env: { COGS_BREAKER_ENABLED: 'true' },
      loadContext: async () =>
        context({ tier: 'free', quota: 0, alreadyTripped: true, costCents: 5_000 }),
      admit,
    });
    expect(responseStatus(result)).toBe(503);
    expect(await responseJson(result)).toMatchObject({ code: 'COGS_BREAKER_TRIPPED' });
    expect(admit).not.toHaveBeenCalled();
  });

  it('does not block a paid tier when the breaker flag is on', async () => {
    const result = await enforceAdminChatRails({
      userId: 'user-1',
      db,
      env: { COGS_BREAKER_ENABLED: 'true' },
      loadContext: async () => context({ tier: 'pro', alreadyTripped: true, costCents: 50_000 }),
      admit: async () => ({ admitted: true }),
    });
    expect(result).toEqual({ accountId: 'acct-1' });
  });

  it('returns 429 when an enforced budget reserve is refused', async () => {
    const result = await enforceAdminChatRails({
      userId: 'user-1',
      db,
      env: { REVEALUI_BUDGETS_MODE: 'enforce' },
      loadContext: async () => context(),
      reserve: async () => ({
        allowed: false,
        mode: 'enforce',
        wouldDeny: true,
        reason: 'budget_hard_stop',
        incidentsOpened: [],
      }),
      admit: async () => ({ admitted: true }),
    });
    expect(responseStatus(result)).toBe(429);
    expect(await responseJson(result)).toMatchObject({ code: 'BUDGET_HARD_STOP' });
  });

  it('allows the call when budgets are off, which is the default', async () => {
    const reserve = vi.fn();
    const result = await enforceAdminChatRails({
      userId: 'user-1',
      db,
      env,
      loadContext: async () => context(),
      reserve,
      admit: async () => ({ admitted: true }),
    });
    expect(result).toEqual({ accountId: 'acct-1' });
    expect(reserve).not.toHaveBeenCalled();
  });

  it('returns 503 when account context cannot be loaded', async () => {
    const result = await enforceAdminChatRails({
      userId: 'user-1',
      db,
      env,
      loadContext: async () => {
        throw new Error('membership down');
      },
    });
    expect(responseStatus(result)).toBe(503);
    expect(await responseJson(result)).toMatchObject({ code: 'RAILS_UNAVAILABLE' });
  });

  it('persists a COGS trip and blocks when daily cost is over the limit', async () => {
    const where = vi.fn(async () => undefined);
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));
    const tripDb = { update } as unknown as Database;
    const admit = vi.fn();
    const result = await enforceAdminChatRails({
      userId: 'user-1',
      db: tripDb,
      env: { COGS_BREAKER_ENABLED: 'true', COGS_BREAKER_DAILY_CENTS: '1000' },
      loadContext: async () =>
        context({ tier: 'free', quota: 0, alreadyTripped: false, costCents: 5_000 }),
      admit,
    });
    expect(responseStatus(result)).toBe(503);
    expect(update).toHaveBeenCalled();
    expect(admit).not.toHaveBeenCalled();
  });

  it('continues in shadow mode when the budget reserve throws', async () => {
    const result = await enforceAdminChatRails({
      userId: 'user-1',
      db,
      env: { REVEALUI_BUDGETS_MODE: 'shadow' },
      loadContext: async () => context(),
      admit: async () => ({ admitted: true }),
    });
    expect(result).toEqual({ accountId: 'acct-1' });
  });

  it('returns 503 when credit billing fails', async () => {
    const result = await enforceAdminChatRails({
      userId: 'user-1',
      db,
      env,
      loadContext: async () => context(),
      admit: async () => ({ admitted: false, reason: 'billing_error' }),
    });
    expect(responseStatus(result)).toBe(503);
    expect(await responseJson(result)).toMatchObject({ code: 'BILLING_ERROR' });
  });

  it('returns 503 when the quota store throws', async () => {
    const result = await enforceAdminChatRails({
      userId: 'user-1',
      db,
      env,
      loadContext: async () => context(),
      admit: async () => {
        throw new Error('db down');
      },
    });
    expect(responseStatus(result)).toBe(503);
    expect(await responseJson(result)).toMatchObject({ code: 'RAILS_UNAVAILABLE' });
  });
});

describe('loadAdminChatAccountContext', () => {
  it('uses a zero quota when the free COGS breaker is already tripped', async () => {
    resolveActiveMembership.mockResolvedValue({ accountId: 'acct-1', role: 'owner' });
    const rows = [
      [
        {
          tier: 'free',
          status: 'active',
          graceUntil: null,
          limits: { maxAgentTasks: 0 },
          cogsBreakerTrippedAt: new Date('2026-10-01T00:00:00.000Z'),
        },
      ],
      [{ costCents: 2500 }],
    ];
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => rows.shift() ?? [],
          }),
        }),
      }),
    } as unknown as Database;

    const loaded = await loadAdminChatAccountContext(
      db,
      'user-1',
      new Date('2026-10-06T00:00:00.000Z'),
    );
    expect(loaded.quota).toBe(0);
    expect(loaded.alreadyTripped).toBe(true);
    expect(loaded.costCents).toBe(2500);
    expect(loaded.accountId).toBe('acct-1');
  });

  it('falls back to the process task quota when the user has no account', async () => {
    resolveActiveMembership.mockResolvedValue(null);
    const loaded = await loadAdminChatAccountContext(
      {} as Database,
      'user-1',
      new Date('2026-10-06T00:00:00.000Z'),
    );
    expect(loaded.accountId).toBeNull();
    expect(loaded.quota).toBe(10_000);
  });
});

describe('estimateLlmCostMicros', () => {
  it('converts the shared token price table into micros', async () => {
    const micros = await estimateLlmCostMicros('gpt-4o-mini', 1_000_000, 1_000_000);
    expect(micros).toBe(750_000);
  });
});

describe('recordAdminChatCall', () => {
  it('writes one llm.chat meter and a receipt without prompt or key material', async () => {
    const inserts: Array<{ table: string; values: Record<string, unknown> }> = [];
    const db = {
      insert: (_table: { [key: symbol]: unknown } | object) => ({
        values: async (values: Record<string, unknown>) => {
          const name =
            values.meterName === LLM_CHAT_METER_NAME || values.route === 'admin.chat'
              ? String(values.meterName ?? values.route)
              : 'row';
          inserts.push({ table: name, values });
        },
      }),
    } as unknown as Database;

    await recordAdminChatCall({
      db,
      userId: 'user-1',
      accountId: 'acct-1',
      provider: 'openai',
      model: 'gpt-4o',
      keySource: 'byok',
      promptTokens: 20,
      completionTokens: 5,
      durationMs: 40,
      errored: false,
      now: new Date('2026-10-06T12:00:00.000Z'),
      env: {},
      estimateMicros: async () => 1_250,
    });

    const receipt = inserts.find((row) => row.values.route === 'admin.chat');
    const meter = inserts.find((row) => row.values.meterName === LLM_CHAT_METER_NAME);
    expect(receipt?.values).toMatchObject({
      userId: 'user-1',
      accountId: 'acct-1',
      provider: 'openai',
      model: 'gpt-4o',
      keySource: 'byok',
      promptTokens: 20,
      completionTokens: 5,
      estimatedCostMicros: 1_250,
    });
    expect(meter?.values).toMatchObject({
      accountId: 'acct-1',
      meterName: 'llm.chat',
      quantity: 1,
      source: 'user',
      durationMs: 40,
      errored: false,
    });
    const encoded = JSON.stringify(inserts);
    expect(encoded).not.toContain('prompt');
    expect(encoded).not.toContain('sk-');
    expect(encoded).not.toContain('apiKey');
  });
});
