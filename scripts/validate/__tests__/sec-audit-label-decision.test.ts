import { describe, expect, it } from 'vitest';

const {
  decide,
  checkState,
  CLEAR_LABEL,
  OVERRIDE_LABEL,
} = require('../sec-audit-label-decision.cjs');

const green = (name: string) => ({ name, conclusion: 'SUCCESS', status: 'COMPLETED' });
const red = (name: string) => ({ name, conclusion: 'FAILURE', status: 'COMPLETED' });
const pending = (name: string) => ({ name, conclusion: null, status: 'IN_PROGRESS' });
const cancelled = (name: string) => ({ name, conclusion: 'CANCELLED', status: 'COMPLETED' });

const ALL = ['Security Gate', 'CodeQL', 'Secret Scanning (Gitleaks)', 'Dependency Review'];
const allGreen = () => ALL.map(green);

describe('checkState', () => {
  it('green when a SUCCESS entry exists', () => {
    expect(checkState([green('CodeQL')], 'CodeQL')).toBe('ok');
  });
  it('failing on a definitive failure', () => {
    expect(checkState([red('CodeQL')], 'CodeQL')).toBe('failing');
  });
  it('missing when the check is absent', () => {
    expect(checkState([green('Other')], 'CodeQL')).toBe('missing');
  });
  it('pending when in progress', () => {
    expect(checkState([pending('CodeQL')], 'CodeQL')).toBe('pending');
  });
  it('cancelled-alongside-success is ok, not failing (fleet superseded rule)', () => {
    expect(checkState([cancelled('CodeQL'), green('CodeQL')], 'CodeQL')).toBe('ok');
  });
  it('failure-alongside-success still fails', () => {
    expect(checkState([green('CodeQL'), red('CodeQL')], 'CodeQL')).toBe('failing');
  });
});

describe('decide', () => {
  it('REVOKES when the label is present and an audit check is failing', () => {
    const r = decide({
      checkRuns: [...allGreen().slice(0, 3), red('Dependency Review')],
      labels: [CLEAR_LABEL],
    });
    expect(r.action).toBe('revoke');
    expect(r.reason).toContain('Dependency Review');
  });
  it('SKIPS (never revokes) when the audit is fully green', () => {
    expect(decide({ checkRuns: allGreen(), labels: [CLEAR_LABEL] }).action).toBe('skip');
  });
  it('SKIPS a pending audit — no false revoke during the in-flight window', () => {
    const runs = [...allGreen().slice(0, 3), pending('Dependency Review')];
    expect(decide({ checkRuns: runs, labels: [CLEAR_LABEL] }).action).toBe('skip');
  });
  it('SKIPS a missing audit check (conservative)', () => {
    expect(decide({ checkRuns: allGreen().slice(0, 3), labels: [CLEAR_LABEL] }).action).toBe(
      'skip',
    );
  });
  it('SKIPS when the clearance label is not present', () => {
    expect(decide({ checkRuns: [red('CodeQL')], labels: ['bug'] }).action).toBe('skip');
  });
  it('SKIPS when the per-PR override label is present, even with a red audit', () => {
    const r = decide({ checkRuns: [red('CodeQL')], labels: [CLEAR_LABEL, OVERRIDE_LABEL] });
    expect(r.action).toBe('skip');
    expect(r.reason).toContain('override');
  });
  it('SKIPS when the kill switch is set, even with a red audit', () => {
    expect(
      decide({ checkRuns: [red('CodeQL')], labels: [CLEAR_LABEL], killSwitch: true }).action,
    ).toBe('skip');
  });
  it('accepts GitHub label objects, not just strings', () => {
    const r = decide({ checkRuns: [red('CodeQL')], labels: [{ name: CLEAR_LABEL }] });
    expect(r.action).toBe('revoke');
  });
});
