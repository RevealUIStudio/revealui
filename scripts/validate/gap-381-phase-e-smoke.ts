/**
 * GAP-381 Phase E automated smoke (no live Cursor/Zed UI).
 *
 * - Public connect guides exist and contain no em dashes
 * - Honest-limit keywords present on Cursor guide
 * - ACP unit acceptance (in-process) via vitest when harnesses deps built
 * - Hook CLI: unsupported source fails closed
 *
 * Exit 0 on pass; non-zero on fail. Not a substitute for the owner walk
 * in docs/runbooks/GAP-381-PHASE-E-OWNER-WALK.md.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const guides = [
  'docs/guides/connect-cursor.md',
  'docs/guides/connect-vscode.md',
  'docs/guides/connect-acp.md',
] as const;

const EM_DASH = '\u2014';
const errors: string[] = [];

function fail(msg: string): void {
  errors.push(msg);
}

for (const rel of guides) {
  const path = join(root, rel);
  if (!existsSync(path)) {
    fail(`missing guide: ${rel}`);
    continue;
  }
  const body = readFileSync(path, 'utf8');
  if (body.includes(EM_DASH)) {
    fail(`em dash found in ${rel}`);
  }
  if (!/^visibility:\s*public/m.test(body)) {
    fail(`${rel}: expected visibility: public`);
  }
}

const cursor = join(root, 'docs/guides/connect-cursor.md');
if (existsSync(cursor)) {
  const body = readFileSync(cursor, 'utf8');
  for (const needle of ['Honest limits', 'closed-source', 'phones home', 'advisory']) {
    if (!body.includes(needle)) {
      fail(`connect-cursor.md missing honesty keyword: ${needle}`);
    }
  }
}

const secrets = join(root, 'docs/SECRETS.md');
if (existsSync(secrets)) {
  const body = readFileSync(secrets, 'utf8');
  for (const path of [
    'revealui/dev/mcp/cursor-device-token',
    'revealui/dev/mcp/vscode-device-token',
  ]) {
    if (!body.includes(path)) {
      fail(`SECRETS.md missing ${path}`);
    }
  }
}

// Hook CLI: unsupported source must exit non-zero (fail closed messaging).
try {
  const harnessesCli = join(root, 'packages/harnesses/dist/cli.js');
  if (existsSync(harnessesCli)) {
    try {
      execFileSync(process.execPath, [harnessesCli, 'hook', 'not-a-source'], {
        input: '{}\n',
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      fail('hook not-a-source exited 0 (expected failure)');
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 0 || status === undefined) {
        fail(`hook not-a-source unexpected: ${String(err)}`);
      }
    }
  } else {
    // Soft skip when dist not built; CI package tests cover hooks.
    process.stderr.write('gap-381-phase-e-smoke: harnesses dist missing; skip hook CLI check\n');
  }
} catch (err) {
  fail(`hook CLI check error: ${err instanceof Error ? err.message : String(err)}`);
}

// ACP acceptance tests when vitest + package present.
const acpTest = join(root, 'packages/harnesses/src/acp/__tests__/acp-agent.test.ts');
if (existsSync(acpTest)) {
  try {
    execFileSync('pnpm', ['--filter', '@revealui/harnesses', 'exec', 'vitest', 'run', 'src/acp'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    const stderr = (err as { stderr?: string }).stderr ?? '';
    fail(`acp vitest failed: ${stderr.slice(0, 500) || String(err)}`);
  }
} else {
  fail('missing acp acceptance tests');
}

if (errors.length > 0) {
  process.stderr.write(`gap-381-phase-e-smoke FAIL (${errors.length})\n`);
  for (const e of errors) {
    process.stderr.write(`  - ${e}\n`);
  }
  process.exit(1);
}

process.stdout.write('gap-381-phase-e-smoke PASS\n');
