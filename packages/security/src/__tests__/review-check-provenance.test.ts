import { describe, expect, it } from 'vitest';
import {
  type ReviewCheckRun,
  type ReviewWorkflowRun,
  resolveReviewRequiredChecks,
  validReviewCheckSelector,
} from '../review-receipt.js';

const headSha = 'a'.repeat(40);
const selector = {
  name: 'CI Feedback',
  appId: 15368,
  workflowId: 220400161,
  workflowPath: '.github/workflows/ci.yml',
  event: 'pull_request' as const,
};
const run = (
  id: number,
  suite: number,
  overrides: Partial<ReviewWorkflowRun> = {},
): ReviewWorkflowRun => ({
  id,
  check_suite_id: suite,
  head_sha: headSha,
  workflow_id: 220400161,
  path: '.github/workflows/ci.yml',
  event: 'pull_request',
  status: 'completed',
  conclusion: 'success',
  repository: { id: 1234 },
  head_repository: { id: 1234 },
  ...overrides,
});
const check = (
  id: number,
  suite: number,
  overrides: Partial<ReviewCheckRun> = {},
): ReviewCheckRun => ({
  id,
  name: 'CI Feedback',
  head_sha: headSha,
  status: 'completed',
  conclusion: 'success',
  completed_at: '2026-10-08T03:00:00Z',
  check_suite: { id: suite },
  app: { id: 15368 },
  ...overrides,
});
const resolve = (overrides: Partial<Parameters<typeof resolveReviewRequiredChecks>[0]> = {}) =>
  resolveReviewRequiredChecks({
    selectors: [selector],
    checkRuns: [check(101, 201), check(102, 202)],
    workflowRuns: [run(301, 201), run(302, 202)],
    repositoryId: 1234,
    headSha,
    changedFiles: ['src/example.ts'],
    ...overrides,
  });

describe('required check workflow provenance', () => {
  it('selects the newest trusted workflow suite despite duplicate Actions job names', () => {
    expect(resolve()).toMatchObject({ ok: true, checks: [{ id: 102, check_suite: { id: 202 } }] });
  });

  it('holds while the newest trusted workflow is running or cancelled', () => {
    for (const status of ['in_progress', 'completed']) {
      const conclusion = status === 'completed' ? 'cancelled' : null;
      expect(
        resolve({ workflowRuns: [run(301, 201), run(302, 202, { status, conclusion })] }),
      ).toEqual({ ok: false, reason: 'receipt_required_workflow_run_not_successful' });
    }
  });

  it('rejects a successful CI Feedback check when another job failed the workflow', () => {
    expect(
      resolve({
        checkRuns: [check(102, 202)],
        workflowRuns: [run(302, 202, { conclusion: 'failure' })],
      }),
    ).toEqual({ ok: false, reason: 'receipt_required_workflow_run_not_successful' });
  });

  it('rejects a same-name check from an untrusted suite and a rerun with stale check evidence', () => {
    expect(resolve({ checkRuns: [check(101, 201), check(102, 999)] })).toEqual({
      ok: false,
      reason: 'receipt_required_check_selector_not_unique',
    });
    expect(
      resolve({ checkRuns: [check(101, 201), check(102, 202, { conclusion: 'failure' })] }),
    ).toEqual({ ok: false, reason: 'receipt_required_check_missing_or_stale' });
  });

  it('holds if a PR changes any workflow or local Action definition', () => {
    for (const path of ['.github/workflows/ci.yml', '.github/actions/shared/action.yml']) {
      expect(resolve({ changedFiles: [path] })).toEqual({
        ok: false,
        reason: 'receipt_workflow_provenance_untrusted',
      });
    }
  });

  it('rejects forged repository, event, path, and workflow identities', () => {
    for (const override of [
      { repository: { id: 9999 } },
      { head_repository: { id: 9999 } },
      { event: 'workflow_dispatch' },
      { path: '.github/workflows/attacker.yml' },
      { workflow_id: 9999 },
    ]) {
      expect(resolve({ workflowRuns: [run(302, 202, override)] })).toEqual({
        ok: false,
        reason: 'receipt_required_workflow_run_missing',
      });
    }
  });

  it('requires Actions selectors to name a trusted workflow, while rejecting extra provenance on App checks', () => {
    expect(validReviewCheckSelector(selector)).toBe(true);
    expect(validReviewCheckSelector({ name: 'CI Feedback', appId: 15368 })).toBe(false);
    expect(
      validReviewCheckSelector({ ...selector, workflowPath: '.github/workflows/../attacker.yml' }),
    ).toBe(false);
    expect(validReviewCheckSelector({ name: 'CodeQL', appId: 57789, workflowId: 1 })).toBe(false);
  });
});
