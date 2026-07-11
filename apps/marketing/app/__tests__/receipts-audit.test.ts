import { describe, expect, it } from 'vitest';
import { RECEIPTS_AUDIT_BANDS, RECEIPTS_AUDIT_QUESTIONS } from '../content/receipts-audit';
import { type AuditAnswer, bandForScore, countReceipts } from '../lib/receipts-audit';

// The scoring is the load-bearing logic of the audit: it turns twelve yes/no
// answers into a receipt count and a band, and the band drives the CTAs. These
// tests pin the band boundaries and the one reverse-scored question (Q5).

const ALL_YES: readonly AuditAnswer[] = RECEIPTS_AUDIT_QUESTIONS.map(() => 'yes');
const ALL_NO: readonly AuditAnswer[] = RECEIPTS_AUDIT_QUESTIONS.map(() => 'no');

describe('receipts-audit scoring', () => {
  it('has exactly twelve questions', () => {
    expect(RECEIPTS_AUDIT_QUESTIONS).toHaveLength(12);
  });

  it('reverse-scores only question 5 (unbounded spend)', () => {
    const reversed = RECEIPTS_AUDIT_QUESTIONS.filter((q) => q.positiveAnswer === 'no');
    expect(reversed).toHaveLength(1);
    expect(reversed[0]?.id).toBe(5);
  });

  describe('countReceipts', () => {
    it('scores 11 when every answer is yes (Q5 yes is the one gap)', () => {
      expect(countReceipts(RECEIPTS_AUDIT_QUESTIONS, ALL_YES)).toBe(11);
    });

    it('scores 1 when every answer is no (Q5 no is the one receipt)', () => {
      expect(countReceipts(RECEIPTS_AUDIT_QUESTIONS, ALL_NO)).toBe(1);
    });

    it('never counts unanswered questions', () => {
      const none = RECEIPTS_AUDIT_QUESTIONS.map(() => null);
      expect(countReceipts(RECEIPTS_AUDIT_QUESTIONS, none)).toBe(0);
    });

    it('counts a single receipt-positive answer', () => {
      const answers: (AuditAnswer | null)[] = RECEIPTS_AUDIT_QUESTIONS.map(() => null);
      answers[0] = 'yes'; // Q1 positive is 'yes'
      expect(countReceipts(RECEIPTS_AUDIT_QUESTIONS, answers)).toBe(1);
      answers[0] = 'no';
      expect(countReceipts(RECEIPTS_AUDIT_QUESTIONS, answers)).toBe(0);
    });
  });

  describe('bandForScore', () => {
    it('bands 10 through 12 as strong', () => {
      expect(bandForScore(12)).toBe('strong');
      expect(bandForScore(10)).toBe('strong');
    });

    it('bands 5 through 9 as partial', () => {
      expect(bandForScore(9)).toBe('partial');
      expect(bandForScore(5)).toBe('partial');
    });

    it('bands 0 through 4 as trust', () => {
      expect(bandForScore(4)).toBe('trust');
      expect(bandForScore(0)).toBe('trust');
    });
  });

  describe('band content', () => {
    it('gives the strong band a single (start-free) CTA', () => {
      const strong = RECEIPTS_AUDIT_BANDS.strong;
      expect(strong.primaryCta.label).toBe('Start free');
      expect(strong.secondaryCta).toBeUndefined();
    });

    it('leads the trust band with the Architecture Review', () => {
      const trust = RECEIPTS_AUDIT_BANDS.trust;
      expect(trust.primaryCta.label).toBe('Book the Architecture Review');
      expect(trust.primaryCta.href).toContain('cal.com');
      expect(trust.secondaryCta?.label).toBe('Start free');
    });

    it('offers both paths in the partial band', () => {
      const partial = RECEIPTS_AUDIT_BANDS.partial;
      expect(partial.primaryCta.label).toBe('Start free');
      expect(partial.secondaryCta?.label).toBe('Book the Architecture Review');
    });
  });
});
