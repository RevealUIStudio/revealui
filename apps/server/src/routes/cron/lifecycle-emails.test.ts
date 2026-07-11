import { describe, expect, it, vi } from 'vitest';

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// getClient must never run in these unit tests  -  every DB/transport boundary
// is injected. A throwing stub proves the injected seam is actually used.
vi.mock('@revealui/db/client', () => ({
  getClient: () => {
    throw new Error('getClient must not be called in unit tests');
  },
}));

import {
  buildDay0Welcome,
  buildDay1Checkin,
  buildDay7Outcome,
  type LifecycleTier,
} from '../../lib/lifecycle-emails.js';
import {
  dueEmailType,
  type LifecycleCandidate,
  type LifecycleClaimInput,
  type LifecycleDeps,
  runLifecycleEmails,
} from './lifecycle-emails.js';

const NOW = new Date('2026-07-11T06:00:00.000Z');
const DAY_MS = 86_400_000;

function cand(opts: {
  ageDays: number;
  userId?: string;
  tier?: LifecycleTier;
  hasAgentAction?: boolean;
  weeklyAgentActions?: number;
}): LifecycleCandidate {
  return {
    userId: opts.userId ?? 'u1',
    email: `${opts.userId ?? 'u1'}@example.com`,
    tier: opts.tier ?? 'free',
    createdAt: new Date(NOW.getTime() - opts.ageDays * DAY_MS),
    hasAgentAction: opts.hasAgentAction ?? false,
    weeklyAgentActions: opts.weeklyAgentActions ?? 0,
  };
}

/** In-memory claim store modeling the unique idempotency_key constraint. */
function claimStore() {
  const keys = new Set<string>();
  const claim = vi.fn(async (input: LifecycleClaimInput) => {
    if (keys.has(input.idempotencyKey)) return false;
    keys.add(input.idempotencyKey);
    return true;
  });
  const release = vi.fn(async (key: string) => {
    keys.delete(key);
  });
  return { keys, claim, release };
}

function makeDeps(opts: {
  enabled: boolean;
  candidates: LifecycleCandidate[];
  store?: ReturnType<typeof claimStore>;
  send?: LifecycleDeps['send'];
}) {
  const store = opts.store ?? claimStore();
  const send = opts.send ?? vi.fn(async () => undefined);
  const deps: LifecycleDeps = {
    enabled: opts.enabled,
    now: NOW,
    loadCandidates: vi.fn(async () => opts.candidates),
    claim: store.claim,
    release: store.release,
    send,
  };
  return { deps, store, send };
}

// ---------------------------------------------------------------------------
// (a) Tier-variant selection
// ---------------------------------------------------------------------------

describe('day-0 welcome tier variance', () => {
  it('the Pro variant leads with the license key and links /account/license', () => {
    const pro = buildDay0Welcome('pro');
    expect(pro.subject).toContain('Pro license key');
    expect(pro.html).toContain('/account/license');
    expect(pro.html.toLowerCase()).toContain('license key');
    expect(pro.html).toContain('Run your first agent');
  });

  it('the Max variant uses the Max label', () => {
    expect(buildDay0Welcome('max').subject).toContain('Max license key');
  });

  it('the Free variant leads with the local agent reply and carries no license link', () => {
    const free = buildDay0Welcome('free');
    expect(free.html).not.toContain('/account/license');
    expect(free.html.toLowerCase()).toContain('agent chat');
    expect(free.subject.toLowerCase()).toContain('welcome');
  });

  it('no email copy contains an em dash', () => {
    const all = [
      buildDay0Welcome('free'),
      buildDay0Welcome('pro'),
      buildDay0Welcome('max'),
      buildDay1Checkin('free'),
      buildDay7Outcome('pro', 5),
      buildDay7Outcome('free', 0),
    ];
    for (const c of all) {
      expect(`${c.subject}\n${c.html}\n${c.text}`).not.toContain('—');
    }
  });

  it('day-7 outcome switches between receipt-count and honest zero framing', () => {
    expect(buildDay7Outcome('pro', 5).html).toContain('took 5 actions');
    expect(buildDay7Outcome('pro', 1).html).toContain('took 1 action this week');
    expect(buildDay7Outcome('free', 0).html.toLowerCase()).toContain('honest zero');
  });
});

// ---------------------------------------------------------------------------
// (b) Day-1 skips when an agent action already exists
// ---------------------------------------------------------------------------

describe('dueEmailType', () => {
  it('selects day0_welcome for a fresh account', () => {
    expect(dueEmailType(cand({ ageDays: 0 }), NOW)).toBe('day0_welcome');
  });

  it('selects day1_checkin in the day-1 window when there is no agent action', () => {
    expect(dueEmailType(cand({ ageDays: 3, hasAgentAction: false }), NOW)).toBe('day1_checkin');
  });

  it('selects nothing in the day-1 window when an agent action exists', () => {
    expect(dueEmailType(cand({ ageDays: 3, hasAgentAction: true }), NOW)).toBeNull();
  });

  it('selects day7_outcome for a one-week-old account', () => {
    expect(dueEmailType(cand({ ageDays: 8 }), NOW)).toBe('day7_outcome');
  });

  it('selects nothing between the day-1 and day-7 windows', () => {
    expect(dueEmailType(cand({ ageDays: 5 }), NOW)).toBeNull();
  });

  it('selects nothing for accounts older than the day-7 window', () => {
    expect(dueEmailType(cand({ ageDays: 20 }), NOW)).toBeNull();
  });
});

describe('runLifecycleEmails day-1 skip', () => {
  it('does not send day-1 when the candidate already has an agent action', async () => {
    const { deps, send } = makeDeps({
      enabled: true,
      candidates: [cand({ ageDays: 3, hasAgentAction: true })],
    });
    const res = await runLifecycleEmails(deps);
    expect(send).not.toHaveBeenCalled();
    expect(res.sent).toBe(0);
  });

  it('sends day-1 when the candidate has no agent action', async () => {
    const { deps, send } = makeDeps({
      enabled: true,
      candidates: [cand({ ageDays: 3, hasAgentAction: false })],
    });
    const res = await runLifecycleEmails(deps);
    expect(send).toHaveBeenCalledTimes(1);
    expect(res.sent).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// (c) Idempotency
// ---------------------------------------------------------------------------

describe('runLifecycleEmails idempotency', () => {
  it('a second evaluation sends nothing', async () => {
    const store = claimStore();
    const candidates = [cand({ ageDays: 0 })];
    const { deps, send } = makeDeps({ enabled: true, candidates, store });

    const first = await runLifecycleEmails(deps);
    const second = await runLifecycleEmails(deps);

    expect(first.sent).toBe(1);
    expect(second.sent).toBe(0);
    expect(second.skipped).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// (d) Disarmed mode never calls the transport
// ---------------------------------------------------------------------------

describe('runLifecycleEmails disarmed', () => {
  it('records a dry-run and never calls the transport', async () => {
    const { deps, send, store } = makeDeps({
      enabled: false,
      candidates: [cand({ ageDays: 0 })],
    });

    const res = await runLifecycleEmails(deps);

    expect(send).not.toHaveBeenCalled();
    expect(res.sent).toBe(0);
    expect(res.dryRun).toBe(1);
    const claimArg = store.claim.mock.calls[0][0];
    expect(claimArg.status).toBe('dry_run');
    expect(claimArg.idempotencyKey).toContain(':dry_run:');
  });

  it('a disarmed dry-run does not consume the armed send slot (build now, arm later)', async () => {
    const store = claimStore();
    const candidates = [cand({ ageDays: 0 })];
    const send = vi.fn(async () => undefined);

    const disarmed = await runLifecycleEmails(
      makeDeps({ enabled: false, candidates, store, send }).deps,
    );
    const armed = await runLifecycleEmails(
      makeDeps({ enabled: true, candidates, store, send }).deps,
    );

    expect(disarmed.dryRun).toBe(1);
    expect(armed.sent).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Resilience: a transport failure must not break the loop
// ---------------------------------------------------------------------------

describe('runLifecycleEmails transport failure', () => {
  it('releases the claim, records a failure, and does not throw', async () => {
    const send = vi.fn(async () => {
      throw new Error('mailer unavailable');
    });
    const { deps, store } = makeDeps({
      enabled: true,
      candidates: [cand({ ageDays: 0 })],
      send,
    });

    const res = await runLifecycleEmails(deps);

    expect(res.failed).toBe(1);
    expect(res.sent).toBe(0);
    expect(store.release).toHaveBeenCalledTimes(1);
    // Claim was released, so the slot is free for the next daily retry.
    expect(store.keys.size).toBe(0);
  });

  it('one failing send does not stop later candidates', async () => {
    let call = 0;
    const send = vi.fn(async () => {
      call += 1;
      if (call === 1) throw new Error('transient');
    });
    const { deps } = makeDeps({
      enabled: true,
      candidates: [cand({ ageDays: 0, userId: 'a' }), cand({ ageDays: 0, userId: 'b' })],
      send,
    });

    const res = await runLifecycleEmails(deps);

    expect(res.failed).toBe(1);
    expect(res.sent).toBe(1);
    expect(send).toHaveBeenCalledTimes(2);
  });
});
