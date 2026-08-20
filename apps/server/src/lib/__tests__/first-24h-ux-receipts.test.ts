import { describe, expect, it } from 'vitest';
import {
  FIRST_24H_UX_ACTOR_ID,
  FIRST_24H_UX_EVENT_TYPE,
  FIRST_24H_UX_RECEIPT_CARD_TITLE,
  FIRST_24H_UX_REPORT_DATE,
  FIRST_24H_UX_SURFACES_2026_08_20,
  type First24hUxReceiptLine,
  first24hPlanLabel,
  first24hUxGuaranteed,
  toFirst24hUxReceiptCardLines,
} from '../first-24h-ux-receipts.js';

describe('first-24h Pro/Max UX receipt catalog (2026-08-20)', () => {
  it('covers every tested surface with actor, action, plan, result, evidence', () => {
    expect(FIRST_24H_UX_SURFACES_2026_08_20.length).toBeGreaterThan(10);
    for (const line of FIRST_24H_UX_SURFACES_2026_08_20) {
      expect(line.surface.length).toBeGreaterThan(0);
      expect(line.actor).toBe(FIRST_24H_UX_ACTOR_ID);
      expect(line.action.length).toBeGreaterThan(0);
      expect(['pro', 'max', 'enterprise', 'none']).toContain(line.plan);
      expect(['PASS', 'FAIL', 'SKIP']).toContain(line.result);
      expect(line.evidence.length).toBeGreaterThan(0);
      if (line.result === 'SKIP') {
        expect(line.skipReason?.length).toBeGreaterThan(0);
      }
    }
  });

  it('labels Max surfaces Max, never Pro', () => {
    const maxLines = FIRST_24H_UX_SURFACES_2026_08_20.filter((line) => line.plan === 'max');
    expect(maxLines.length).toBeGreaterThan(0);
    for (const line of maxLines) {
      expect(first24hPlanLabel(line.plan)).toBe('Max');
      expect(first24hPlanLabel(line.plan)).not.toBe('Pro');
    }
  });

  it('does not guarantee first-24h UX while an essential SKIP remains', () => {
    expect(FIRST_24H_UX_REPORT_DATE).toBe('2026-08-20');
    expect(first24hUxGuaranteed(FIRST_24H_UX_SURFACES_2026_08_20)).toBe(false);
    expect(
      FIRST_24H_UX_SURFACES_2026_08_20.some(
        (line) => line.result === 'SKIP' && line.essential === true,
      ),
    ).toBe(true);
    expect(FIRST_24H_UX_SURFACES_2026_08_20.some((line) => line.result === 'FAIL')).toBe(false);
  });

  it('maps stored receipt rows onto ReceiptCard lines without a Merkle seal', () => {
    const timestamp = new Date('2026-08-20T12:00:00.000Z');
    const maxLine = FIRST_24H_UX_SURFACES_2026_08_20.find((line) => line.plan === 'max');
    if (!maxLine) throw new Error('expected a Max catalog line');
    const lines = toFirst24hUxReceiptCardLines([
      {
        id: 'rcpt-max-1',
        timestamp,
        payload: {
          actor: maxLine.actor,
          action: maxLine.action,
          plan: maxLine.plan,
          planLabel: first24hPlanLabel(maxLine.plan),
          result: maxLine.result,
          evidence: maxLine.evidence,
          surface: maxLine.surface,
          merkleRootDelivered: false,
        },
      },
    ]);
    expect(FIRST_24H_UX_EVENT_TYPE).toBe('verification.first24h.ux');
    expect(FIRST_24H_UX_RECEIPT_CARD_TITLE).toContain('2026-08-20');
    expect(lines).toHaveLength(1);
    expect(lines[0]?.actor).toBe(FIRST_24H_UX_ACTOR_ID);
    expect(lines[0]?.object).toContain('Max');
    expect(lines[0]?.object).toContain(maxLine.result);
    expect(lines[0]?.refId).toBe('rcpt-max-1');
    expect(lines[0]?.ts).toBe(timestamp.toISOString());
  });

  it('treats any FAIL as not guaranteed', () => {
    const failing: First24hUxReceiptLine[] = [
      {
        surface: 'demo',
        actor: FIRST_24H_UX_ACTOR_ID,
        action: 'verify',
        plan: 'pro',
        result: 'FAIL',
        evidence: 'broke',
      },
    ];
    expect(first24hUxGuaranteed(failing)).toBe(false);
  });
});
