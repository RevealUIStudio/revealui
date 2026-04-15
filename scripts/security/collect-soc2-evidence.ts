/**
 * SOC2 Evidence Collection Script
 *
 * Exports a monthly evidence snapshot from GitHub and local audit data
 * for SOC2 Type II compliance. Produces a dated directory of JSON/CSV
 * files suitable for auditor review.
 *
 * Usage:
 *   GITHUB_TOKEN="ghp_..." pnpm tsx scripts/security/collect-soc2-evidence.ts
 *   GITHUB_TOKEN="ghp_..." pnpm tsx scripts/security/collect-soc2-evidence.ts --month 2026-03
 *
 * Output: docs/security/evidence/<YYYY-MM>/
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO = 'RevealUIStudio/revealui';

// Parse --month flag or default to current month
const monthArg =
  process.argv.find((a) => a.startsWith('--month='))?.split('=')[1] ??
  process.argv[process.argv.indexOf('--month') + 1];

const now = new Date();
const targetMonth =
  monthArg ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const [year, month] = targetMonth.split('-').map(Number);
const since = new Date(year, month - 1, 1).toISOString();
const until = new Date(year, month, 0, 23, 59, 59).toISOString();

const outputDir = join(process.cwd(), 'docs', 'security', 'evidence', targetMonth);

interface GitHubResponse {
  // biome-ignore lint/suspicious/noExplicitAny: GitHub API response varies
  [key: string]: any;
}

async function ghApi(endpoint: string): Promise<GitHubResponse | GitHubResponse[]> {
  const url = endpoint.startsWith('http') ? endpoint : `https://api.github.com/${endpoint}`;
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
  if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<GitHubResponse | GitHubResponse[]>;
}

function writeEvidence(filename: string, data: unknown): void {
  const path = join(outputDir, filename);
  writeFileSync(path, JSON.stringify(data, null, 2));
  console.log(`  Written: ${filename}`);
}

async function collectPRs(): Promise<void> {
  console.log('\n1. Pull Requests (code review evidence)');

  // Fetch merged PRs in the date range
  const searchQuery = `repo:${REPO} is:pr is:merged merged:${since.slice(0, 10)}..${until.slice(0, 10)}`;
  const result = (await ghApi(
    `search/issues?q=${encodeURIComponent(searchQuery)}&per_page=100`,
  )) as GitHubResponse;

  const prs = (result.items ?? []).map((pr: GitHubResponse) => ({
    number: pr.number,
    title: pr.title,
    author: pr.user?.login,
    merged_at: pr.pull_request?.merged_at,
    url: pr.html_url,
  }));

  writeEvidence('pull-requests.json', {
    period: targetMonth,
    count: prs.length,
    items: prs,
  });
}

async function collectWorkflowRuns(): Promise<void> {
  console.log('\n2. CI/CD Pipeline Runs');

  const runs = (await ghApi(
    `repos/${REPO}/actions/runs?created=${since.slice(0, 10)}..${until.slice(0, 10)}&per_page=100`,
  )) as GitHubResponse;

  const summary = {
    period: targetMonth,
    total_runs: runs.total_count,
    by_conclusion: {} as Record<string, number>,
    by_workflow: {} as Record<string, number>,
  };

  for (const run of runs.workflow_runs ?? []) {
    const conclusion = run.conclusion ?? 'in_progress';
    summary.by_conclusion[conclusion] = (summary.by_conclusion[conclusion] ?? 0) + 1;
    const name = run.name ?? 'unknown';
    summary.by_workflow[name] = (summary.by_workflow[name] ?? 0) + 1;
  }

  writeEvidence('ci-cd-runs.json', summary);
}

async function collectSecurityAlerts(): Promise<void> {
  console.log('\n3. Security Alerts (Dependabot + CodeQL)');

  try {
    const dependabot = (await ghApi(
      `repos/${REPO}/dependabot/alerts?state=open&per_page=100`,
    )) as GitHubResponse[];
    const codeql = (await ghApi(
      `repos/${REPO}/code-scanning/alerts?state=open&per_page=100`,
    )) as GitHubResponse[];

    writeEvidence('security-alerts.json', {
      period: targetMonth,
      dependabot: { open_count: Array.isArray(dependabot) ? dependabot.length : 0 },
      codeql: { open_count: Array.isArray(codeql) ? codeql.length : 0 },
    });
  } catch {
    // Security alerts API requires specific permissions
    console.log('  SKIP: Requires security alert permissions on token');
    writeEvidence('security-alerts.json', {
      period: targetMonth,
      error: 'Insufficient token permissions — add security_events scope',
    });
  }
}

function collectGitStats(): void {
  console.log('\n4. Git Commit Stats');

  const log = execSync(
    `git log --after="${since}" --before="${until}" --format="%H|%ae|%aI|%s" --no-merges`,
    { encoding: 'utf8', cwd: process.cwd() },
  ).trim();

  const commits = log
    ? log.split('\n').map((line) => {
        const [hash, author, date, ...msg] = line.split('|');
        return { hash, author, date, message: msg.join('|') };
      })
    : [];

  const byAuthor: Record<string, number> = {};
  for (const c of commits) {
    byAuthor[c.author] = (byAuthor[c.author] ?? 0) + 1;
  }

  writeEvidence('git-stats.json', {
    period: targetMonth,
    total_commits: commits.length,
    by_author: byAuthor,
    first_commit: commits.at(-1)?.date,
    last_commit: commits[0]?.date,
  });
}

function collectDrillRecords(): void {
  console.log('\n5. Drill Records');

  const drillDir = join(process.cwd(), 'docs', 'security', 'drill-records');
  const exists = existsSync(drillDir);

  writeEvidence('drill-records.json', {
    period: targetMonth,
    drill_directory_exists: exists,
    note: 'Manual drill records are stored in docs/security/drill-records/. Review for quarterly access reviews, backup verification drills, and incident response exercises.',
  });
}

async function run(): Promise<void> {
  console.log(`SOC2 Evidence Collection — ${targetMonth}`);
  console.log('='.repeat(50));
  console.log(`Output: ${outputDir}`);

  mkdirSync(outputDir, { recursive: true });

  if (!GITHUB_TOKEN) {
    console.log('\nWARNING: GITHUB_TOKEN not set — GitHub API calls may be rate-limited');
  }

  collectGitStats();
  collectDrillRecords();

  if (GITHUB_TOKEN) {
    await collectPRs();
    await collectWorkflowRuns();
    await collectSecurityAlerts();
  } else {
    console.log('\nSKIPPING GitHub API evidence (set GITHUB_TOKEN for full collection)');
  }

  // Summary
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Evidence package written to: ${outputDir}`);
  console.log('Review and archive before submitting to auditor.');
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
