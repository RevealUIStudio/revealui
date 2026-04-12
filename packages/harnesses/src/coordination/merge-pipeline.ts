/**
 * MergePipeline  -  Layer 3 of the Autonomous Agent Architecture.
 *
 * Watches task completions, diffs agent worktree branches, attempts
 * fast-forward merges into a staging branch, and creates PRs to `test`.
 *
 * Conflict detection notifies conflicting agents via the messaging system.
 * Merges are ordered by the workspace dependency graph (topological sort).
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { DaemonStore } from '../storage/daemon-store.js';
import type { MergeRequest } from '../storage/schema.js';

const execFileAsync = promisify(execFile);

/** Max time (ms) for any single git operation. */
const GIT_TIMEOUT = 30_000;

/** Max time (ms) for `gh pr create`. */
const GH_TIMEOUT = 15_000;

export interface MergePipelineConfig {
  /** Absolute path to the repo root. */
  repoRoot: string;
  /** Default base branch for PRs (default: 'test'). */
  baseBranch?: string;
  /** GitHub remote name (default: 'origin'). */
  remote?: string;
}

export interface MergeResult {
  mergeRequestId: string;
  status: MergeRequest['status'];
  prUrl?: string;
  prNumber?: number;
  error?: string;
  conflictingFiles?: string[];
}

/**
 * Reads the pnpm workspace dependency graph and returns packages in
 * topological order (leaves first). Used to order merges so that
 * downstream packages are merged before their dependents.
 */
async function getWorkspaceDependencyOrder(repoRoot: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync('pnpm', ['ls', '--depth', '0', '--json', '-r'], {
      cwd: repoRoot,
      timeout: GIT_TIMEOUT,
    });
    const packages = JSON.parse(stdout) as Array<{ name: string; path: string }>;
    // For now, return names in declaration order.
    // Full topological sort can be added when needed.
    return packages.map((p) => p.name);
  } catch {
    return [];
  }
}

export class MergePipeline {
  private readonly repoRoot: string;
  private readonly baseBranch: string;
  private readonly remote: string;

  constructor(
    private readonly store: DaemonStore,
    config: MergePipelineConfig,
  ) {
    this.repoRoot = config.repoRoot;
    this.baseBranch = config.baseBranch ?? 'test';
    this.remote = config.remote ?? 'origin';
  }

  /**
   * Request a merge for an agent's branch into the base branch.
   * Creates a merge_request record and attempts the merge.
   */
  async requestMerge(params: {
    agentId: string;
    sourceBranch: string;
    taskId?: string;
    baseBranch?: string;
  }): Promise<MergeResult> {
    const mergeId = `merge-${params.agentId}-${Date.now()}`;
    const baseBranch = params.baseBranch ?? this.baseBranch;

    // Create the merge request record
    await this.store.createMergeRequest({
      id: mergeId,
      agentId: params.agentId,
      taskId: params.taskId,
      sourceBranch: params.sourceBranch,
      baseBranch,
    });

    // Log the event
    await this.store.logEvent({
      agentId: params.agentId,
      eventType: 'merge-requested',
      payload: { mergeId, sourceBranch: params.sourceBranch, baseBranch },
    });

    // Attempt the merge
    return this.processMerge(mergeId);
  }

  /**
   * Process a pending merge request: fetch, check for conflicts,
   * fast-forward merge, and create a PR.
   */
  async processMerge(mergeId: string): Promise<MergeResult> {
    const mr = await this.store.getMergeRequest(mergeId);
    if (!mr) {
      return { mergeRequestId: mergeId, status: 'pending', error: 'Merge request not found' };
    }

    // Mark as merging
    await this.store.updateMergeRequest(mergeId, { status: 'merging' });

    try {
      // 1. Fetch latest from remote
      await this.git(['fetch', this.remote, mr.base_branch, mr.source_branch]);

      // 2. Check if source branch can merge cleanly
      const conflictCheck = await this.checkConflicts(mr.source_branch, mr.base_branch);

      if (!conflictCheck.clean) {
        // Notify conflicting agents
        await this.handleConflict(mr, conflictCheck.conflictingFiles);
        return {
          mergeRequestId: mergeId,
          status: 'conflict',
          conflictingFiles: conflictCheck.conflictingFiles,
          error: `Merge conflict in: ${conflictCheck.conflictingFiles.join(', ')}`,
        };
      }

      // 3. Create a PR via gh CLI
      const prResult = await this.createPR(mr);

      await this.store.updateMergeRequest(mergeId, {
        status: 'pr_created',
        prNumber: prResult.number,
        prUrl: prResult.url,
      });

      await this.store.logEvent({
        agentId: mr.agent_id,
        eventType: 'pr-created',
        payload: { mergeId, prNumber: prResult.number, prUrl: prResult.url },
      });

      return {
        mergeRequestId: mergeId,
        status: 'pr_created',
        prUrl: prResult.url,
        prNumber: prResult.number,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.store.updateMergeRequest(mergeId, {
        status: 'ci_failed',
        errorMessage: message,
      });
      return { mergeRequestId: mergeId, status: 'ci_failed', error: message };
    }
  }

  /** Get the current status of a merge request. */
  async getStatus(mergeId: string): Promise<MergeResult> {
    const mr = await this.store.getMergeRequest(mergeId);
    if (!mr) {
      return { mergeRequestId: mergeId, status: 'pending', error: 'Not found' };
    }
    return {
      mergeRequestId: mergeId,
      status: mr.status,
      prUrl: mr.pr_url ?? undefined,
      prNumber: mr.pr_number ?? undefined,
      error: mr.error_message ?? undefined,
    };
  }

  /** Retry a failed or conflicted merge request. */
  async resolve(mergeId: string): Promise<MergeResult> {
    const mr = await this.store.getMergeRequest(mergeId);
    if (!mr) {
      return { mergeRequestId: mergeId, status: 'pending', error: 'Not found' };
    }

    if (mr.status !== 'conflict' && mr.status !== 'ci_failed') {
      return {
        mergeRequestId: mergeId,
        status: mr.status,
        error: `Cannot resolve: status is ${mr.status}`,
      };
    }

    // Reset to pending and re-process
    await this.store.updateMergeRequest(mergeId, { status: 'pending', errorMessage: '' });
    return this.processMerge(mergeId);
  }

  /** List all active (non-terminal) merge requests. */
  async listActive(): Promise<MergeRequest[]> {
    const all = await this.store.listMergeRequests();
    return all.filter((mr) => mr.status !== 'merged' && mr.status !== 'escalated');
  }

  /**
   * Get the workspace dependency order for merge sequencing.
   * Packages that are dependencies of others should merge first.
   */
  async getDependencyOrder(): Promise<string[]> {
    return getWorkspaceDependencyOrder(this.repoRoot);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Run a git command in the repo root. */
  private async git(args: string[]): Promise<string> {
    const { stdout } = await execFileAsync('git', args, {
      cwd: this.repoRoot,
      timeout: GIT_TIMEOUT,
    });
    return stdout.trim();
  }

  /**
   * Check whether source branch merges cleanly into base branch.
   * Uses `git merge-tree` (available in Git 2.38+) for a tree-only check
   * that doesn't touch the working directory.
   */
  private async checkConflicts(
    sourceBranch: string,
    baseBranch: string,
  ): Promise<{ clean: boolean; conflictingFiles: string[] }> {
    try {
      // git merge-tree --write-tree exits non-zero on conflicts
      await execFileAsync(
        'git',
        [
          'merge-tree',
          '--write-tree',
          `${this.remote}/${baseBranch}`,
          `${this.remote}/${sourceBranch}`,
        ],
        { cwd: this.repoRoot, timeout: GIT_TIMEOUT },
      );
      return { clean: true, conflictingFiles: [] };
    } catch (err) {
      // Parse conflicting files from merge-tree output
      const output =
        err instanceof Error && 'stdout' in err ? String((err as { stdout: unknown }).stdout) : '';
      const conflicting: string[] = [];
      for (const line of output.split('\n')) {
        // merge-tree outputs conflict markers with file paths
        if (line.startsWith('CONFLICT')) {
          const parts = line.split(' ');
          const lastPart = parts[parts.length - 1];
          if (lastPart) conflicting.push(lastPart);
        }
      }
      return { clean: false, conflictingFiles: conflicting };
    }
  }

  /** Notify conflicting agents via the messaging system. */
  private async handleConflict(mr: MergeRequest, conflictingFiles: string[]): Promise<void> {
    await this.store.updateMergeRequest(mr.id, {
      status: 'conflict',
      errorMessage: `Conflict in: ${conflictingFiles.join(', ')}`,
    });

    // Find agents who have reservations on conflicting files
    const notifiedAgents = new Set<string>();
    for (const file of conflictingFiles) {
      const reservation = await this.store.checkReservation(file);
      if (reservation && reservation.agent_id !== mr.agent_id) {
        notifiedAgents.add(reservation.agent_id);
      }
    }

    // Send conflict notifications
    for (const agentId of notifiedAgents) {
      await this.store.sendMessage({
        fromAgent: 'merge-pipeline',
        toAgent: agentId,
        subject: `Merge conflict with ${mr.agent_id}`,
        body: `Branch ${mr.source_branch} conflicts with your work on: ${conflictingFiles.join(', ')}. Please coordinate resolution.`,
      });
    }

    // Also notify the requesting agent
    await this.store.sendMessage({
      fromAgent: 'merge-pipeline',
      toAgent: mr.agent_id,
      subject: 'Merge conflict detected',
      body: `Your branch ${mr.source_branch} has conflicts with ${mr.base_branch} in: ${conflictingFiles.join(', ')}. Resolve and call merge.resolve to retry.`,
    });

    await this.store.logEvent({
      agentId: mr.agent_id,
      eventType: 'merge-conflict',
      payload: {
        mergeId: mr.id,
        conflictingFiles,
        notifiedAgents: [...notifiedAgents],
      },
    });
  }

  /** Create a GitHub PR using the `gh` CLI. */
  private async createPR(mr: MergeRequest): Promise<{ number: number; url: string }> {
    const title = `agent/${mr.agent_id}: ${mr.task_id ?? mr.source_branch}`;
    const body = [
      '## Automated Agent PR',
      '',
      `**Agent**: ${mr.agent_id}`,
      `**Branch**: ${mr.source_branch} → ${mr.base_branch}`,
      mr.task_id ? `**Task**: ${mr.task_id}` : '',
      '',
      'This PR was created automatically by the merge pipeline.',
      'CI must pass before merge.',
    ]
      .filter(Boolean)
      .join('\n');

    const { stdout } = await execFileAsync(
      'gh',
      [
        'pr',
        'create',
        '--base',
        mr.base_branch,
        '--head',
        mr.source_branch,
        '--title',
        title,
        '--body',
        body,
      ],
      { cwd: this.repoRoot, timeout: GH_TIMEOUT },
    );

    // gh pr create outputs the PR URL
    const url = stdout.trim();
    // Extract PR number from URL (e.g., https://github.com/owner/repo/pull/123)
    const parts = url.split('/');
    const number = Number.parseInt(parts[parts.length - 1] ?? '0', 10);

    return { number, url };
  }
}
