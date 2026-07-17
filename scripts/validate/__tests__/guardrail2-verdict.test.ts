import { describe, expect, it } from 'vitest';

const {
  verdictForBody,
  collectVerdicts,
  evaluateGuardrail2,
} = require('../guardrail2-verdict.cjs');

const RC_MARKER = '<!-- guardrail2-verdict: REQUEST-CHANGES -->';
const AP_MARKER = '<!-- guardrail2-verdict: APPROVE -->';

// A realistic verdict comment: human-readable heading + the machine marker on its
// own trailing line, exactly as the marker contract prescribes.
const rcBody = `## Guardrail-2 security verdict: REQUEST-CHANGES\n\nTwo blockers found.\n\n${RC_MARKER}`;
const apBody = `## Guardrail-2 security verdict: APPROVE\n\nLooks good.\n\n${AP_MARKER}`;

const review = (login: string, ts: string, body: string) => ({
  author: { login },
  submittedAt: ts,
  body,
});
const comment = (login: string, ts: string, body: string) => ({
  author: { login },
  createdAt: ts,
  body,
});

describe('verdictForBody', () => {
  it('reads a well-formed REQUEST-CHANGES marker on its own line', () => {
    expect(verdictForBody(rcBody)).toBe('REQUEST-CHANGES');
  });
  it('reads a well-formed APPROVE marker', () => {
    expect(verdictForBody(apBody)).toBe('APPROVE');
  });
  it('returns null when there is no marker', () => {
    expect(verdictForBody('## verdict: APPROVE (heading only, no marker)')).toBeNull();
  });
  it('ignores a marker with an unknown token (malformed)', () => {
    expect(verdictForBody('<!-- guardrail2-verdict: MAYBE -->')).toBeNull();
  });
  it('ignores prose that merely mentions the marker mid-sentence', () => {
    // Not a bare marker line: there is text after the closing --> so endsWith fails.
    expect(
      verdictForBody('The contract is `<!-- guardrail2-verdict: APPROVE -->` on its own line.'),
    ).toBeNull();
  });
  it('takes the LAST well-formed marker when a body carries duplicates', () => {
    // A reviewer who corrects themselves within one comment: last line wins.
    expect(verdictForBody(`${AP_MARKER}\nOn reflection:\n${RC_MARKER}`)).toBe('REQUEST-CHANGES');
  });
  it('handles a non-string / empty body without throwing', () => {
    expect(verdictForBody(undefined)).toBeNull();
    expect(verdictForBody('')).toBeNull();
  });
});

describe('collectVerdicts', () => {
  it('tags author vs non-author and normalizes both timestamp fields', () => {
    const recs = collectVerdicts({
      reviews: [review('reviewer', '2026-07-16T02:00:00Z', apBody)],
      comments: [comment('builder', '2026-07-16T01:00:00Z', rcBody)],
      authorLogin: 'builder',
    });
    expect(recs).toEqual([
      {
        verdict: 'APPROVE',
        timestamp: '2026-07-16T02:00:00Z',
        author: 'reviewer',
        isAuthor: false,
      },
      {
        verdict: 'REQUEST-CHANGES',
        timestamp: '2026-07-16T01:00:00Z',
        author: 'builder',
        isAuthor: true,
      },
    ]);
  });
  it('drops bodies without a marker', () => {
    const recs = collectVerdicts({
      comments: [comment('x', '2026-07-16T01:00:00Z', 'no marker here')],
    });
    expect(recs).toEqual([]);
  });
});

describe('evaluateGuardrail2 — no markers', () => {
  it('returns no-marker so the caller falls back to legacy label logic', () => {
    expect(
      evaluateGuardrail2({ comments: [comment('x', '2026-07-16T01:00:00Z', 'hi')] }).status,
    ).toBe('no-marker');
    expect(evaluateGuardrail2({}).status).toBe('no-marker');
  });
});

describe('evaluateGuardrail2 — distinct-reviewer topology (spec primary logic)', () => {
  it('HOLDS on a lone non-author REQUEST-CHANGES', () => {
    const r = evaluateGuardrail2({
      comments: [comment('reviewer', '2026-07-16T01:00:00Z', rcBody)],
      authorLogin: 'builder',
    });
    expect(r.status).toBe('hold');
    expect(r.reviewer).toBe('reviewer');
  });
  it('CLEARS when a later non-author APPROVE resolves the REQUEST-CHANGES', () => {
    const r = evaluateGuardrail2({
      comments: [
        comment('reviewer', '2026-07-16T01:00:00Z', rcBody),
        comment('reviewer', '2026-07-16T03:00:00Z', apBody),
      ],
      authorLogin: 'builder',
    });
    expect(r.status).toBe('clear');
  });
  it("IGNORES the author's own REQUEST-CHANGES when a non-author APPROVE exists", () => {
    // The builder cannot re-block a reviewer-approved PR: with a non-author verdict
    // present, author markers are excluded entirely — even a LATER author RC.
    const r = evaluateGuardrail2({
      comments: [
        comment('reviewer', '2026-07-16T01:00:00Z', apBody),
        comment('builder', '2026-07-16T05:00:00Z', rcBody),
      ],
      authorLogin: 'builder',
    });
    expect(r.status).toBe('clear');
  });
  it('the builder cannot self-clear a reviewer REQUEST-CHANGES with a later author APPROVE', () => {
    const r = evaluateGuardrail2({
      comments: [
        comment('reviewer', '2026-07-16T01:00:00Z', rcBody),
        comment('builder', '2026-07-16T05:00:00Z', apBody),
      ],
      authorLogin: 'builder',
    });
    expect(r.status).toBe('hold');
    expect(r.reviewer).toBe('reviewer');
  });
});

describe('evaluateGuardrail2 — single-login fail-safe (current fleet topology)', () => {
  // Verified 2026-07-16: every fleet comment/review is authored by RevealUIStudio,
  // the PR author too. Login cannot separate reviewer from builder, so author
  // markers must NOT be dropped — dropping them would ignore the reviewer's own
  // REQUEST-CHANGES, which IS the #1910 miss. Latest verdict governs; RC holds.
  it('HOLDS on a latest author-login REQUEST-CHANGES (the #1910 reviewer verdict)', () => {
    const r = evaluateGuardrail2({
      comments: [
        comment('RevealUIStudio', '2026-07-17T00:04:57Z', apBody),
        comment('RevealUIStudio', '2026-07-17T00:13:55Z', rcBody),
      ],
      authorLogin: 'RevealUIStudio',
    });
    expect(r.status).toBe('hold');
  });
  it('CLEARS when the latest same-login verdict is APPROVE', () => {
    const r = evaluateGuardrail2({
      comments: [
        comment('RevealUIStudio', '2026-07-17T00:13:55Z', rcBody),
        comment('RevealUIStudio', '2026-07-17T00:20:00Z', apBody),
      ],
      authorLogin: 'RevealUIStudio',
    });
    expect(r.status).toBe('clear');
  });
  it('breaks a same-timestamp tie toward REQUEST-CHANGES (fail-safe)', () => {
    const r = evaluateGuardrail2({
      comments: [
        comment('RevealUIStudio', '2026-07-17T00:13:55Z', apBody),
        comment('RevealUIStudio', '2026-07-17T00:13:55Z', rcBody),
      ],
      authorLogin: 'RevealUIStudio',
    });
    expect(r.status).toBe('hold');
  });
});

// The regression the whole change exists to prevent. Reproduces revealui#1910:
// a security-sensitive PR carrying sec-review:approved with a live REQUEST-CHANGES
// verdict. BEFORE this change the gate cleared it on the label; AFTER, it holds.
describe('evaluateGuardrail2 — revealui#1910 prove-red (before/after)', () => {
  const pr1910 = {
    author: { login: 'RevealUIStudio' },
    labels: [{ name: 'sec-review:approved' }],
    reviewDecision: '',
    reviews: [],
    comments: [
      comment('RevealUIStudio', '2026-07-17T00:04:57Z', apBody),
      comment('RevealUIStudio', '2026-07-17T00:13:55Z', rcBody),
    ],
  };

  // The OLD gate logic, verbatim: label present OR approving review → clear.
  function legacyDecision(pr: typeof pr1910): 'clear' | 'hold' {
    const labels = new Set(pr.labels.map((l) => l.name));
    const hasReviewLabel = [...labels].some((l) =>
      ['sec-review:approved', 'security-reviewed', 'coordinator-approved'].includes(l),
    );
    const approved = pr.reviewDecision === 'APPROVED';
    return approved || hasReviewLabel ? 'clear' : 'hold';
  }

  it('BEFORE: the legacy label-only logic cleared #1910 (the bug)', () => {
    expect(legacyDecision(pr1910)).toBe('clear');
  });

  it('AFTER: the marker-aware evaluation HOLDS #1910 despite the label', () => {
    const r = evaluateGuardrail2({
      reviews: pr1910.reviews,
      comments: pr1910.comments,
      authorLogin: pr1910.author.login,
    });
    expect(r.status).toBe('hold');
    expect(r.timestamp).toBe('2026-07-17T00:13:55Z');
  });
});
