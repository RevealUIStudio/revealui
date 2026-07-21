import { describe, expect, it } from 'vitest';
import { buildCandidates, DAY_7_MS, HOUR_24_MS, type NudgeSignals } from '../triggers.js';

const BASE_SIGNALS: NudgeSignals = {
  hasAssistantReply: false,
  userChatMessageCount: 0,
  hasPageOrProduct: false,
  hasAgentAction: false,
  hasInferenceConfig: false,
  hasAuditExport: false,
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
    expect(ids(buildCandidates('max', BASE_SIGNALS))).not.toContain('free-first-reply');
    expect(ids(buildCandidates('enterprise', BASE_SIGNALS))).not.toContain('free-first-reply');
  });

  it('pro-first-action appears for pro, max, and enterprise but not free', () => {
    const signals = BASE_SIGNALS;
    expect(ids(buildCandidates('free', signals))).not.toContain('pro-first-action');
    expect(ids(buildCandidates('pro', signals))).toContain('pro-first-action');
    expect(ids(buildCandidates('max', signals))).toContain('pro-first-action');
    expect(ids(buildCandidates('enterprise', signals))).toContain('pro-first-action');
  });

  it('max-local-inference appears only for max and enterprise, once old enough', () => {
    const signals: NudgeSignals = { ...BASE_SIGNALS, accountAgeMs: HOUR_24_MS };
    expect(ids(buildCandidates('pro', signals))).not.toContain('max-local-inference');
    expect(ids(buildCandidates('max', signals))).toContain('max-local-inference');
    expect(ids(buildCandidates('enterprise', signals))).toContain('max-local-inference');
  });

  it('ent-second-tenant appears only for enterprise', () => {
    const signals: NudgeSignals = { ...BASE_SIGNALS, siteCount: 1, accountAgeMs: DAY_7_MS };
    expect(ids(buildCandidates('max', signals))).not.toContain('ent-second-tenant');
    expect(ids(buildCandidates('enterprise', signals))).toContain('ent-second-tenant');
  });

  it('max-export-audit appears for max and enterprise once day-7+ and never for free/pro', () => {
    const signals: NudgeSignals = { ...BASE_SIGNALS, accountAgeMs: DAY_7_MS };
    expect(ids(buildCandidates('free', signals))).not.toContain('max-export-audit');
    expect(ids(buildCandidates('pro', signals))).not.toContain('max-export-audit');
    expect(ids(buildCandidates('max', signals))).toContain('max-export-audit');
    expect(ids(buildCandidates('enterprise', signals))).toContain('max-export-audit');
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
    const tooFewMessages = buildCandidates('free', {
      ...BASE_SIGNALS,
      userChatMessageCount: 2,
    });
    const readyButNoContent = buildCandidates('free', {
      ...BASE_SIGNALS,
      userChatMessageCount: 3,
    });
    const milestoneAlreadyLanded = buildCandidates('free', {
      ...BASE_SIGNALS,
      userChatMessageCount: 5,
      hasPageOrProduct: true,
    });
    expect(ids(tooFewMessages)).not.toContain('free-first-content');
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
    const tooEarly = buildCandidates('max', { ...BASE_SIGNALS, accountAgeMs: HOUR_24_MS - 1 });
    const dueButUnset = buildCandidates('max', { ...BASE_SIGNALS, accountAgeMs: HOUR_24_MS });
    const configured = buildCandidates('max', {
      ...BASE_SIGNALS,
      accountAgeMs: HOUR_24_MS,
      hasInferenceConfig: true,
    });
    expect(ids(tooEarly)).not.toContain('max-local-inference');
    expect(ids(dueButUnset)).toContain('max-local-inference');
    expect(ids(configured)).not.toContain('max-local-inference');
  });

  it('ent-second-tenant needs exactly one site, day-7+, and retires once a second site exists', () => {
    const noTenantYet = buildCandidates('enterprise', {
      ...BASE_SIGNALS,
      siteCount: 0,
      accountAgeMs: DAY_7_MS,
    });
    const tooEarly = buildCandidates('enterprise', {
      ...BASE_SIGNALS,
      siteCount: 1,
      accountAgeMs: DAY_7_MS - 1,
    });
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
    expect(ids(noTenantYet)).not.toContain('ent-second-tenant');
    expect(ids(tooEarly)).not.toContain('ent-second-tenant');
    expect(ids(dueWithOneSite)).toContain('ent-second-tenant');
    expect(ids(secondSiteLanded)).not.toContain('ent-second-tenant');
  });

  it('max-export-audit waits for day 7 and retires after an audit export meter row', () => {
    const tooEarly = buildCandidates('max', { ...BASE_SIGNALS, accountAgeMs: DAY_7_MS - 1 });
    const due = buildCandidates('max', { ...BASE_SIGNALS, accountAgeMs: DAY_7_MS });
    const exported = buildCandidates('max', {
      ...BASE_SIGNALS,
      accountAgeMs: DAY_7_MS,
      hasAuditExport: true,
    });
    expect(ids(tooEarly)).not.toContain('max-export-audit');
    expect(ids(due)).toContain('max-export-audit');
    expect(ids(exported)).not.toContain('max-export-audit');
  });
});

describe('buildCandidates — priority tags match the milestone order', () => {
  it('tags each implemented nudge with its documented milestone rank', () => {
    const signals: NudgeSignals = {
      hasAssistantReply: false,
      userChatMessageCount: 3,
      hasPageOrProduct: false,
      hasAgentAction: false,
      hasInferenceConfig: false,
      hasAuditExport: false,
      accountAgeMs: DAY_7_MS,
      siteCount: 1,
    };
    const byId = new Map(buildCandidates('enterprise', signals).map((c) => [c.id, c.milestone]));
    expect(byId.get('pro-first-action')).toBe('hour1');
    expect(byId.get('max-local-inference')).toBe('hour24');
    expect(byId.get('max-export-audit')).toBe('day7');
    expect(byId.get('ent-second-tenant')).toBe('day7');
  });
});
