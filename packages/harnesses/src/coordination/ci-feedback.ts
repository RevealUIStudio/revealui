/**
 * CIFeedback — Layer 4 of the Autonomous Agent Architecture.
 *
 * Receives CI results (posted by GitHub Actions via the daemon's HTTP gateway),
 * and routes them back to agents:
 *   - Green: mark merge request as merged, complete the linked task
 *   - Red: parse the failure category, create a fix task, assign back
 *          to the originating agent (up to MAX_RETRIES), then escalate
 *
 * The CI workflow posts to `POST /rpc` with method `ci.report`.
 */

import type { DaemonStore } from '../storage/daemon-store.js';
import type { MergeRequest } from '../storage/schema.js';

/** Maximum retries before escalating to human. */
const MAX_RETRIES = 3;

/** Categories of CI failure for structured parsing. */
export type CIFailureCategory = 'lint' | 'typecheck' | 'test' | 'build' | 'e2e' | 'unknown';

export interface CIReportParams {
  /** PR number the CI ran on. */
  prNumber?: number;
  /** Branch name the CI ran on (fallback lookup if prNumber missing). */
  branch?: string;
  /** Whether CI passed. */
  success: boolean;
  /** Raw CI output (truncated to 10KB by the caller). */
  output?: string;
  /** GitHub Actions run URL for reference. */
  runUrl?: string;
  /** Which CI job failed (e.g., 'quality', 'typecheck', 'test-unit', 'build'). */
  failedJob?: string;
}

export interface CIFeedbackResult {
  action: 'merged' | 'fix_task_created' | 'escalated' | 'no_merge_request' | 'error';
  mergeRequestId?: string;
  taskId?: string;
  retryCount?: number;
  error?: string;
}

export class CIFeedback {
  constructor(private readonly store: DaemonStore) {}

  /**
   * Handle a CI report. Called when GitHub Actions posts results
   * to the daemon HTTP gateway.
   */
  async report(params: CIReportParams): Promise<CIFeedbackResult> {
    // 1. Find the merge request
    const mr = await this.findMergeRequest(params);
    if (!mr) {
      return { action: 'no_merge_request' };
    }

    // 2. Log the CI event
    await this.store.logEvent({
      agentId: mr.agent_id,
      eventType: params.success ? 'ci-passed' : 'ci-failed',
      payload: {
        mergeId: mr.id,
        prNumber: params.prNumber,
        failedJob: params.failedJob,
        runUrl: params.runUrl,
      },
    });

    if (params.success) {
      return this.handleSuccess(mr);
    }
    return this.handleFailure(mr, params);
  }

  // ---------------------------------------------------------------------------
  // Private — success path
  // ---------------------------------------------------------------------------

  private async handleSuccess(mr: MergeRequest): Promise<CIFeedbackResult> {
    // Mark merge request as merged
    await this.store.updateMergeRequest(mr.id, { status: 'merged' });

    // Complete the linked task if one exists
    if (mr.task_id) {
      await this.store.completeTask(mr.task_id, mr.agent_id);
    }

    // Mark the worktree as merged
    await this.store.updateWorktreeStatus(mr.agent_id, 'merged');

    // Notify the agent
    await this.store.sendMessage({
      fromAgent: 'ci-feedback',
      toAgent: mr.agent_id,
      subject: 'CI passed — PR ready to merge',
      body: `PR ${mr.pr_url ?? `#${mr.pr_number}`} passed CI. Merge request ${mr.id} is complete.`,
    });

    // Store a memory entry for the agent
    await this.store.storeMemory({
      agentId: mr.agent_id,
      memoryType: 'result',
      content: `CI passed for ${mr.source_branch}. PR ${mr.pr_number ?? '(unknown)'} is ready.`,
      metadata: { mergeId: mr.id, prNumber: mr.pr_number },
    });

    return { action: 'merged', mergeRequestId: mr.id };
  }

  // ---------------------------------------------------------------------------
  // Private — failure path
  // ---------------------------------------------------------------------------

  private async handleFailure(mr: MergeRequest, params: CIReportParams): Promise<CIFeedbackResult> {
    // Increment retry count
    const retryCount = await this.store.incrementMergeRetry(mr.id);

    // Save the CI output
    await this.store.updateMergeRequest(mr.id, {
      status: 'ci_failed',
      ciOutput: params.output?.slice(0, 10_000),
      errorMessage: `CI failed (attempt ${retryCount}/${MAX_RETRIES}): ${params.failedJob ?? 'unknown job'}`,
    });

    // If max retries exceeded, escalate to human
    if (retryCount >= MAX_RETRIES) {
      return this.escalate(mr, retryCount, params);
    }

    // Parse the failure and create a fix task
    const category = this.categorizeFailure(params);
    const taskId = `fix-${mr.id}-${retryCount}`;
    const description = this.buildFixTaskDescription(mr, category, params);

    await this.store.createTask({ id: taskId, description });
    await this.store.claimTask(taskId, mr.agent_id);

    // Notify the agent
    await this.store.sendMessage({
      fromAgent: 'ci-feedback',
      toAgent: mr.agent_id,
      subject: `CI failed — fix task created (attempt ${retryCount}/${MAX_RETRIES})`,
      body: description,
    });

    // Store failure as agent memory so next session sees it
    await this.store.storeMemory({
      agentId: mr.agent_id,
      memoryType: 'action',
      content: `CI failed on ${mr.source_branch}: ${category} error. Fix task ${taskId} created. Attempt ${retryCount}/${MAX_RETRIES}.`,
      metadata: {
        mergeId: mr.id,
        category,
        failedJob: params.failedJob,
        retryCount,
      },
    });

    return {
      action: 'fix_task_created',
      mergeRequestId: mr.id,
      taskId,
      retryCount,
    };
  }

  /** Escalate to human after max retries. */
  private async escalate(
    mr: MergeRequest,
    retryCount: number,
    params: CIReportParams,
  ): Promise<CIFeedbackResult> {
    await this.store.updateMergeRequest(mr.id, { status: 'escalated' });

    // Broadcast escalation to all active agents
    await this.store.broadcastMessage({
      fromAgent: 'ci-feedback',
      subject: `ESCALATION: ${mr.source_branch} failed CI ${retryCount} times`,
      body: [
        `Merge request ${mr.id} has failed CI ${retryCount} times and needs human intervention.`,
        `Agent: ${mr.agent_id}`,
        `Branch: ${mr.source_branch} → ${mr.base_branch}`,
        `PR: ${mr.pr_url ?? `#${mr.pr_number}`}`,
        `Last failure: ${params.failedJob ?? 'unknown'}`,
        `Run: ${params.runUrl ?? 'no URL'}`,
      ].join('\n'),
    });

    await this.store.logEvent({
      agentId: mr.agent_id,
      eventType: 'merge-escalated',
      payload: {
        mergeId: mr.id,
        retryCount,
        failedJob: params.failedJob,
        runUrl: params.runUrl,
      },
    });

    return {
      action: 'escalated',
      mergeRequestId: mr.id,
      retryCount,
    };
  }

  // ---------------------------------------------------------------------------
  // Private — helpers
  // ---------------------------------------------------------------------------

  /** Find the merge request associated with this CI run. */
  private async findMergeRequest(params: CIReportParams): Promise<MergeRequest | null> {
    // Try by PR number first (most reliable)
    if (params.prNumber) {
      const mr = await this.store.getMergeRequestByPr(params.prNumber);
      if (mr) return mr;
    }
    // Fall back to branch name
    if (params.branch) {
      return this.store.getMergeRequestByBranch(params.branch);
    }
    return null;
  }

  /** Categorize the CI failure from the job name or output. */
  private categorizeFailure(params: CIReportParams): CIFailureCategory {
    const job = params.failedJob?.toLowerCase() ?? '';
    const output = params.output?.toLowerCase() ?? '';

    if (job.includes('lint') || job.includes('quality')) return 'lint';
    if (job.includes('typecheck') || job.includes('type')) return 'typecheck';
    if (job.includes('test') && !job.includes('e2e')) return 'test';
    if (job.includes('build')) return 'build';
    if (job.includes('e2e') || job.includes('playwright')) return 'e2e';

    // Fall back to output parsing
    if (output.includes('biome') || output.includes('lint')) return 'lint';
    if (output.includes('ts2') || output.includes('type error')) return 'typecheck';
    if (output.includes('vitest') || output.includes('test failed')) return 'test';
    if (output.includes('build failed') || output.includes('esbuild')) return 'build';

    return 'unknown';
  }

  /** Build a descriptive fix task for the agent. */
  private buildFixTaskDescription(
    mr: MergeRequest,
    category: CIFailureCategory,
    params: CIReportParams,
  ): string {
    const lines = [`Fix CI ${category} failure on branch ${mr.source_branch}.`];

    switch (category) {
      case 'lint':
        lines.push('Run `pnpm lint:fix` and commit the changes.');
        break;
      case 'typecheck':
        lines.push('Run `pnpm typecheck:all` locally and fix type errors.');
        break;
      case 'test':
        lines.push('Run `pnpm test` locally and fix failing tests.');
        break;
      case 'build':
        lines.push('Run `pnpm build` locally and fix build errors.');
        break;
      case 'e2e':
        lines.push('Check Playwright E2E test output and fix the failing scenarios.');
        break;
      default:
        lines.push('Review the CI output and fix the issue.');
    }

    if (params.runUrl) {
      lines.push(`CI run: ${params.runUrl}`);
    }

    // Include a snippet of the output for context
    if (params.output) {
      const truncated = params.output.slice(0, 2000);
      lines.push('', 'CI output (truncated):', '```', truncated, '```');
    }

    return lines.join('\n');
  }
}
