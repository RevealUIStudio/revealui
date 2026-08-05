import { describe, expect, it } from 'vitest';
import {
  checkSecReviewLabelApply,
  evaluateSecurityAuditRollup,
  isSecReviewApprovedLabelAdd,
  REQUIRED_SECURITY_AUDIT_CHECKS,
} from '../sec-review-label-gate.js';

const greenRollup = REQUIRED_SECURITY_AUDIT_CHECKS.map((name) => ({
  name,
  conclusion: 'SUCCESS',
  state: 'COMPLETED',
}));

describe('isSecReviewApprovedLabelAdd', () => {
  it('detects gh pr edit --add-label sec-review:approved', () => {
    expect(
      isSecReviewApprovedLabelAdd(
        'gh pr edit 123 -R RevealUIStudio/revealui --add-label "sec-review:approved"',
      ),
    ).toBe(true);
  });

  it('ignores prose that only mentions the label', () => {
    expect(
      isSecReviewApprovedLabelAdd('echo "do not apply sec-review:approved until audit is green"'),
    ).toBe(false);
  });

  it('ignores remove-label', () => {
    expect(isSecReviewApprovedLabelAdd('gh pr edit 1 --remove-label "sec-review:approved"')).toBe(
      false,
    );
  });
});

describe('evaluateSecurityAuditRollup', () => {
  it('accepts all required checks SUCCESS', () => {
    expect(evaluateSecurityAuditRollup(greenRollup).ok).toBe(true);
  });

  it('fails closed on missing check', () => {
    const r = evaluateSecurityAuditRollup([{ name: 'Security Gate', conclusion: 'SUCCESS' }]);
    expect(r.ok).toBe(false);
    expect(r.problems.some((p) => p.includes('CodeQL'))).toBe(true);
  });

  it('fails on FAILURE conclusion', () => {
    const rollup = greenRollup.map((c) =>
      c.name === 'CodeQL' ? { ...c, conclusion: 'FAILURE' } : c,
    );
    expect(evaluateSecurityAuditRollup(rollup).ok).toBe(false);
  });
});

describe('checkSecReviewLabelApply', () => {
  const cmd = 'gh pr edit 9 --add-label sec-review:approved';

  it('allows non-label commands', () => {
    expect(checkSecReviewLabelApply('pnpm test', greenRollup).block).toBe(false);
  });

  it('blocks when rollup is null (fail closed)', () => {
    const r = checkSecReviewLabelApply(cmd, null);
    expect(r.block).toBe(true);
    expect(r.message).toMatch(/fail-closed/i);
  });

  it('blocks when audit not green', () => {
    const r = checkSecReviewLabelApply(cmd, [{ name: 'Security Gate', conclusion: 'FAILURE' }]);
    expect(r.block).toBe(true);
  });

  it('allows when audit green', () => {
    expect(checkSecReviewLabelApply(cmd, greenRollup).block).toBe(false);
  });

  it('override bypasses with overridden flag', () => {
    const r = checkSecReviewLabelApply(cmd, null, { override: true });
    expect(r.block).toBe(false);
    expect(r.overridden).toBe(true);
  });
});
