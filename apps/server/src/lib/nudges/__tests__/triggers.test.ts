import { describe, expect, it } from 'vitest';
import { buildCandidates, DAY_3_MS, DAY_7_MS, HOUR_24_MS, type NudgeSignals } from '../triggers.js';

const BASE_SIGNALS: NudgeSignals = {
  hasAssistantReply: false,
  userChatMessageCount: 0,
  hasPageOrProduct: false,
  hasAgentAction: false,
  agentTaskCount: 0,
  hasInferenceConfig: false,
  hasAuditExport: false,
  hasAuditView: false,
  hasUpgradeIntent: false,
  hasLicenseKey: false,
  hasLicenseKeyFetched: false,
  hasDataConnection: false,
  hasAiMemorySession: false,
  accountAgeMs: 0,
  siteCount: 0,
};

function ids(candidates: ReturnType<typeof buildCandidates>): string[] {
  return candidates.map((c) => c.id);
}

describe('buildCandidates — tier gating', () => {
  it('free-first-reply only appears for the free tier', () => {
    expect(ids(buildCandidates('free', BASE_SIGNALS))).toContain('free-first-reply');
    expect(ids(buildCandidates('pro', BASE_SIGNALS))).not.toContain('free-first-reply');
  });

  it('pro-first-action appears for pro, max, and enterprise but not free', () => {
    expect(ids(buildCandidates('free', BASE_SIGNALS))).not.toContain('pro-first-action');
    expect(ids(buildCandidates('pro', BASE_SIGNALS))).toContain('pro-first-action');
    expect(ids(buildCandidates('max', BASE_SIGNALS))).toContain('pro-first-action');
  });

  it('max-local-inference appears only for max and enterprise, once old enough', () => {
    const signals: NudgeSignals = { ...BASE_SIGNALS, accountAgeMs: HOUR_24_MS };
    expect(ids(buildCandidates('pro', signals))).not.toContain('max-local-inference');
    expect(ids(buildCandidates('max', signals))).toContain('max-local-inference');
  });

  it('ent-second-tenant appears only for enterprise', () => {
    const signals: NudgeSignals = { ...BASE_SIGNALS, siteCount: 1, accountAgeMs: DAY_7_MS };
    expect(ids(buildCandidates('max', signals))).not.toContain('ent-second-tenant');
    expect(ids(buildCandidates('enterprise', signals))).toContain('ent-second-tenant');
  });

  it('max-export-audit appears for max and enterprise once day-7+', () => {
    const signals: NudgeSignals = { ...BASE_SIGNALS, accountAgeMs: DAY_7_MS };
    expect(ids(buildCandidates('pro', signals))).not.toContain('max-export-audit');
    expect(ids(buildCandidates('max', signals))).toContain('max-export-audit');
  });

  it('pro-read-receipts appears for paid tiers with 3+ agent tasks and no audit view', () => {
    const ready: NudgeSignals = { ...BASE_SIGNALS, agentTaskCount: 3, hasAgentAction: true };
    expect(ids(buildCandidates('pro', ready))).toContain('pro-read-receipts');
    expect(ids(buildCandidates('free', ready))).not.toContain('pro-read-receipts');
  });

  it('free-pro-gate appears only for free tier once upgrade intent is recorded', () => {
    const withIntent: NudgeSignals = { ...BASE_SIGNALS, hasUpgradeIntent: true };
    expect(ids(buildCandidates('free', withIntent))).toContain('free-pro-gate');
    expect(ids(buildCandidates('pro', withIntent))).not.toContain('free-pro-gate');
  });

  it('pro-license-wire when key exists and has not been fetched', () => {
    const ready: NudgeSignals = { ...BASE_SIGNALS, hasLicenseKey: true };
    expect(ids(buildCandidates('pro', ready))).toContain('pro-license-wire');
    expect(ids(buildCandidates('free', ready))).not.toContain('pro-license-wire');
    expect(ids(buildCandidates('pro', { ...ready, hasLicenseKeyFetched: true }))).not.toContain(
      'pro-license-wire',
    );
  });

  it('pro-connect-data after day 3 without a data connection', () => {
    const ready: NudgeSignals = { ...BASE_SIGNALS, accountAgeMs: DAY_3_MS };
    expect(ids(buildCandidates('pro', ready))).toContain('pro-connect-data');
    expect(
      ids(buildCandidates('pro', { ...BASE_SIGNALS, accountAgeMs: DAY_3_MS - 1 })),
    ).not.toContain('pro-connect-data');
    expect(ids(buildCandidates('pro', { ...ready, hasDataConnection: true }))).not.toContain(
      'pro-connect-data',
    );
  });

  it('max-enable-memory for max/enterprise without a memory session', () => {
    expect(ids(buildCandidates('max', BASE_SIGNALS))).toContain('max-enable-memory');
    expect(ids(buildCandidates('pro', BASE_SIGNALS))).not.toContain('max-enable-memory');
    expect(
      ids(buildCandidates('max', { ...BASE_SIGNALS, hasAiMemorySession: true })),
    ).not.toContain('max-enable-memory');
  });
});

describe('buildCandidates — retirement on milestone event', () => {
  it('free-first-reply retires the instant an assistant reply exists', () => {
    const before = buildCandidates('free', { ...BASE_SIGNALS, hasAssistantReply: false });
    const after = buildCandidates('free', { ...BASE_SIGNALS, hasAssistantReply: true });
    expect(ids(before)).toContain('free-first-reply');
    expect(ids(after)).not.toContain('free-first-reply');
  });

  it('free-first-content needs 3+ chat messages AND no page/product yet', () => {
    const readyButNoContent = buildCandidates('free', {
      ...BASE_SIGNALS,
      userChatMessageCount: 3,
    });
    const milestoneAlreadyLanded = buildCandidates('free', {
      ...BASE_SIGNALS,
      userChatMessageCount: 5,
      hasPageOrProduct: true,
    });
    expect(ids(readyButNoContent)).toContain('free-first-content');
    expect(ids(milestoneAlreadyLanded)).not.toContain('free-first-content');
  });

  it('pro-first-action retires once any agent-sourced usage-meter event exists', () => {
    const before = buildCandidates('pro', { ...BASE_SIGNALS, hasAgentAction: false });
    const after = buildCandidates('pro', { ...BASE_SIGNALS, hasAgentAction: true });
    expect(ids(before)).toContain('pro-first-action');
    expect(ids(after)).not.toContain('pro-first-action');
  });

  it('max-local-inference retires once an inference config exists, and waits for hour 24', () => {
    const dueButUnset = buildCandidates('max', { ...BASE_SIGNALS, accountAgeMs: HOUR_24_MS });
    const configured = buildCandidates('max', {
      ...BASE_SIGNALS,
      accountAgeMs: HOUR_24_MS,
      hasInferenceConfig: true,
    });
    expect(ids(dueButUnset)).toContain('max-local-inference');
    expect(ids(configured)).not.toContain('max-local-inference');
  });

  it('ent-second-tenant needs exactly one site, day-7+', () => {
    const dueWithOneSite = buildCandidates('enterprise', {
      ...BASE_SIGNALS,
      siteCount: 1,
      accountAgeMs: DAY_7_MS,
    });
    const secondSiteLanded = buildCandidates('enterprise', {
      ...BASE_SIGNALS,
      siteCount: 2,
      accountAgeMs: DAY_7_MS,
    });
    expect(ids(dueWithOneSite)).toContain('ent-second-tenant');
    expect(ids(secondSiteLanded)).not.toContain('ent-second-tenant');
  });

  it('max-export-audit waits for day 7 and retires after export', () => {
    const due = buildCandidates('max', { ...BASE_SIGNALS, accountAgeMs: DAY_7_MS });
    const exported = buildCandidates('max', {
      ...BASE_SIGNALS,
      accountAgeMs: DAY_7_MS,
      hasAuditExport: true,
    });
    expect(ids(due)).toContain('max-export-audit');
    expect(ids(exported)).not.toContain('max-export-audit');
  });

  it('pro-read-receipts retires once the audit trail has been viewed', () => {
    const ready: NudgeSignals = {
      ...BASE_SIGNALS,
      agentTaskCount: 5,
      hasAgentAction: true,
    };
    expect(ids(buildCandidates('pro', ready))).toContain('pro-read-receipts');
    expect(ids(buildCandidates('pro', { ...ready, hasAuditView: true }))).not.toContain(
      'pro-read-receipts',
    );
  });
});

describe('buildCandidates — priority tags match the milestone order', () => {
  it('tags each implemented nudge with its documented milestone rank', () => {
    const signals: NudgeSignals = {
      ...BASE_SIGNALS,
      hasLicenseKey: true,
      agentTaskCount: 3,
      accountAgeMs: DAY_7_MS,
      siteCount: 1,
    };
    const byId = new Map(buildCandidates('enterprise', signals).map((c) => [c.id, c.milestone]));
    expect(byId.get('pro-first-action')).toBe('hour1');
    expect(byId.get('max-enable-memory')).toBe('hour1');
    expect(byId.get('pro-license-wire')).toBe('hour24');
    expect(byId.get('pro-read-receipts')).toBe('hour24');
    expect(byId.get('max-local-inference')).toBe('hour24');
    expect(byId.get('pro-connect-data')).toBe('day7');
    expect(byId.get('max-export-audit')).toBe('day7');
    expect(byId.get('ent-second-tenant')).toBe('day7');
  });
});
