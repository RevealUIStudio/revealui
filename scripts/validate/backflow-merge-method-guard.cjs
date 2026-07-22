#!/usr/bin/env node
// backflow-merge-method-guard.cjs — soft-enforce merge-commit for main→test backflow.
//
// GitHub cannot set a per-PR-class default merge method (squash remains allowed
// for feature→test). This guard:
//
//   1. PR mode (base=test, backflow-shaped title/head): fail until the PR carries
//      the acknowledgment label `backflow:merge-commit`, and print UI instructions
//      to use **Create a merge commit** (not Squash / Rebase).
//   2. Ancestry mode (push to test / offline): fail if origin/main is not an
//      ancestor of HEAD — catches a squash-merged backflow after the fact.
//
// Non-backflow PRs exit 0 immediately so this check is safe to require on every
// PR into test (skipped-logic is "pass", not "job skipped").
//
// Zero authored regex (fleet no-regex). Dependency-free (Node + git).
//
// Usage:
//   node scripts/validate/backflow-merge-method-guard.cjs --mode=pr
//     env: PR_TITLE, PR_HEAD_REF, PR_BASE_REF, PR_LABELS (comma-separated)
//   node scripts/validate/backflow-merge-method-guard.cjs --mode=ancestry
//     cwd = git repo; fetches not performed (caller must fetch main)

'use strict';

const { execFileSync } = require('node:child_process');

const ACK_LABEL = 'backflow:merge-commit';

function parseArgs(argv) {
  let mode = 'pr';
  for (const a of argv) {
    if (a.startsWith('--mode=')) mode = a.slice('--mode='.length);
  }
  return { mode };
}

function includesFold(haystack, needle) {
  return String(haystack).toLowerCase().includes(String(needle).toLowerCase());
}

/**
 * True when this PR is a main→test backflow (title/head convention used by the
 * org backflow app + manual backflow PRs).
 *
 * Do NOT treat every branch under chore/backflow-* as backflow (e.g.
 * chore/backflow-merge-commit-guard is a feature PR that implements this guard).
 */
function isBackflowPr(title, headRef, baseRef) {
  if (baseRef !== 'test') return false;
  // Head is literally main, or the automated backflow branch name.
  if (headRef === 'main') return true;
  if (headRef === 'chore/backflow-main-into-test') return true;
  if (headRef.startsWith('chore/backflow-main-into-test-')) return true;
  // Title shape used by the reusable backflow app / manual promos.
  // Example: "chore(test): backflow main into test (1 commit(s) behind)"
  if (
    includesFold(title, 'backflow') &&
    includesFold(title, 'main into test')
  ) {
    return true;
  }
  if (
    includesFold(title, 'backflow main into test') ||
    includesFold(title, 'backflow main → test') ||
    includesFold(title, 'backflow main -> test')
  ) {
    return true;
  }
  return false;
}

function parseLabels(raw) {
  if (!raw || !String(raw).trim()) return [];
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function runPrMode() {
  const title = process.env.PR_TITLE || '';
  const headRef = process.env.PR_HEAD_REF || '';
  const baseRef = process.env.PR_BASE_REF || '';
  const labels = parseLabels(process.env.PR_LABELS || '');

  if (!isBackflowPr(title, headRef, baseRef)) {
    console.log(
      `Not a backflow PR (base=${baseRef || '?'}, head=${headRef || '?'}) — policy N/A.`,
    );
    process.exit(0);
  }

  console.log('Backflow PR detected (main → test ancestry path).');
  console.log('');
  console.log('HARDLINE: merge with Create a merge commit only.');
  console.log('  Squash or rebase strips main parentage and breaks the next promote.');
  console.log('');
  console.log('GitHub UI: open the merge dropdown → "Create a merge commit" → Merge.');
  console.log('CLI:');
  console.log('  gh pr merge <N> --repo RevealUIStudio/revealui --merge');
  console.log('');
  console.log(`Acknowledgment label required on this PR: ${ACK_LABEL}`);
  console.log(`  gh pr edit <N> --repo RevealUIStudio/revealui --add-label "${ACK_LABEL}"`);
  console.log('');

  if (labels.includes(ACK_LABEL)) {
    console.log(`Label "${ACK_LABEL}" present — clear (still use merge-commit in the UI).`);
    process.exit(0);
  }

  console.error(
    `::error title=Backflow merge method::Add label "${ACK_LABEL}" and merge with Create a merge commit (not Squash).`,
  );
  process.exit(1);
}

function runAncestryMode() {
  let mainSha;
  try {
    mainSha = git(['rev-parse', 'origin/main']);
  } catch {
    console.error('::error title=Missing origin/main::Fetch origin/main before running ancestry mode.');
    process.exit(1);
  }

  let headSha;
  try {
    headSha = git(['rev-parse', 'HEAD']);
  } catch {
    console.error('::error title=Not a git repo::Run from the repository root.');
    process.exit(1);
  }

  try {
    execFileSync('git', ['merge-base', '--is-ancestor', mainSha, headSha], {
      encoding: 'utf8',
    });
    console.log(`HEAD contains origin/main (${mainSha.slice(0, 12)}) ✓`);
    process.exit(0);
  } catch {
    let behind = '?';
    try {
      behind = git(['rev-list', '--count', `HEAD..${mainSha}`]);
    } catch {
      // ignore
    }
    console.error(
      `::error title=test lost main ancestry::HEAD is ${behind} commit(s) behind main and does not contain main as an ancestor. A squash-merged backflow (or incomplete backflow) strips parentage.`,
    );
    console.error('');
    console.error('Repair with a real merge commit:');
    console.error('  git fetch origin');
    console.error('  git checkout test');
    console.error('  git merge --no-ff origin/main');
    console.error('  git push origin test');
    console.error('');
    console.error('Or open/merge the automated backflow PR with --merge (not --squash).');
    process.exit(1);
  }
}

function main() {
  const { mode } = parseArgs(process.argv.slice(2));
  if (mode === 'pr') {
    runPrMode();
    return;
  }
  if (mode === 'ancestry') {
    runAncestryMode();
    return;
  }
  console.error(`Unknown --mode=${mode} (expected pr|ancestry)`);
  process.exit(2);
}

main();
