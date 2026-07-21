/**
 * Nudge trigger evaluation — tier + signal gating (GAP-300 §7).
 *
 * Pure mapping from (tier, observed signals) to the set of nudge ids whose
 * trigger currently holds. Kept separate from DB access (./signals.ts) so
 * tier gating and milestone-retirement are unit-testable without mocking
 * a database.
 *
 * Implemented triggers live here; remaining deferred ids still need real
 * signals (see definitions.ts IMPLEMENTED_NUDGE_IDS + #1929 rationale).
 */

import type { LicenseTier } from '@revealui/core/license';
import type { NudgeCandidate } from './selection.js';

export interface NudgeSignals {
  /** True once any assistant reply exists in the user's local chat. */
  hasAssistantReply: boolean;
  /** Count of user-authored chat messages, for the "3+ chat uses" trigger. */
  userChatMessageCount: number;
  /** True once the user has created a page or a product. */
  hasPageOrProduct: boolean;
  /** True once a governed (source='agent') usage-meter event exists for the account. */
  hasAgentAction: boolean;
  /** Count of agent-sourced usage_meters rows (for 3+ task milestones). */
  agentTaskCount: number;
  /** True once any site owned by the user has a workspace inference config. */
  hasInferenceConfig: boolean;
  /**
   * True once the account has exported the audit log
   * (usage_meters.meter_name = audit_export, source = user).
   */
  hasAuditExport: boolean;
  /**
   * True once the account listed the audit log at least once
   * (usage_meters.meter_name = audit_view, source = user).
   */
  hasAuditView: boolean;
  /**
   * True once a free-tier user knowingly hit a paid feature gate
   * (usage_meters.meter_name = upgrade_intent, source = user).
   */
  hasUpgradeIntent: boolean;
  /** Milliseconds since the user's account was created. */
  accountAgeMs: number;
  /** Count of non-deleted sites owned by the user. */
  siteCount: number;
}

/** Meter name written by GET /admin/audit/export for the max-export-audit nudge. */
export const AUDIT_EXPORT_METER_NAME = 'audit_export';
/** Meter name written by GET /admin/audit list for pro-read-receipts. */
export const AUDIT_VIEW_METER_NAME = 'audit_view';
/** Meter name written when requireFeature blocks a free-tier caller. */
export const UPGRADE_INTENT_METER_NAME = 'upgrade_intent';

export const HOUR_24_MS = 24 * 60 * 60 * 1000;
export const DAY_7_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Builds the trigger-holding candidate list for a given tier + signal
 * snapshot. A nudge is absent from the result whenever its tier doesn't
 * match, its milestone has already landed, or (for the age-gated nudges)
 * the account isn't old enough yet — all three are "not eligible right
 * now," and `selectNudge` treats absence identically either way.
 */
export function buildCandidates(tier: LicenseTier, signals: NudgeSignals): NudgeCandidate[] {
  const candidates: NudgeCandidate[] = [];

  if (tier === 'free') {
    if (!signals.hasAssistantReply) {
      candidates.push({ id: 'free-first-reply', milestone: 'hour1' });
    }
    if (signals.userChatMessageCount >= 3 && !signals.hasPageOrProduct) {
      candidates.push({ id: 'free-first-content', milestone: 'hour24' });
    }
    if (signals.hasUpgradeIntent) {
      candidates.push({ id: 'free-pro-gate', milestone: 'day7' });
    }
  }

  if (tier === 'pro' || tier === 'max' || tier === 'enterprise') {
    if (!signals.hasAgentAction) {
      candidates.push({ id: 'pro-first-action', milestone: 'hour1' });
    }
    if (signals.agentTaskCount >= 3 && !signals.hasAuditView) {
      candidates.push({ id: 'pro-read-receipts', milestone: 'hour24' });
    }
  }

  if (tier === 'max' || tier === 'enterprise') {
    if (!signals.hasInferenceConfig && signals.accountAgeMs >= HOUR_24_MS) {
      candidates.push({ id: 'max-local-inference', milestone: 'hour24' });
    }
    if (!signals.hasAuditExport && signals.accountAgeMs >= DAY_7_MS) {
      candidates.push({ id: 'max-export-audit', milestone: 'day7' });
    }
  }

  if (tier === 'enterprise') {
    if (signals.siteCount === 1 && signals.accountAgeMs >= DAY_7_MS) {
      candidates.push({ id: 'ent-second-tenant', milestone: 'day7' });
    }
  }

  return candidates;
}
