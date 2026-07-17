/**
 * End-to-end coverage for `revealui-harnesses hook <source>` -- spawns the
 * real CLI entrypoint (via the workspace-root `tsx`, so no build step is
 * required) with a real stdin pipe, matching how an editor's hooks.json
 * actually invokes this command. Unlike the unit tests in
 * `hook-run.test.ts` (which call `runHookCommand` directly), this proves
 * the stdin-read / exit-code / stdout-JSON wiring in `../cli.ts` itself.
 */

import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const repoRoot = resolve(packageRoot, '..', '..');
const tsxBin = join(repoRoot, 'node_modules', '.bin', 'tsx');
const cliEntry = join(packageRoot, 'src', 'cli.ts');

interface HookCliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * `spawnSync`, not `execFile`/`spawn` (async) -- the async pipe-write path
 * for a subprocess's stdin hangs indefinitely in this build/test sandbox
 * for reasons unrelated to the CLI itself (reproduced against a plain
 * built `dist/cli.js` with no `tsx` involved at all; `spawnSync`'s
 * synchronous fd-based write does not hit whatever the async path hits).
 * Manually verified the CLI is correct under a real shell pipe
 * (`echo '{...}' | tsx src/cli.ts hook cursor`) before landing this.
 */
function runHookCliRaw(source: string, stdin: string, env: Record<string, string>): HookCliResult {
  const result = spawnSync(tsxBin, [cliEntry, 'hook', source], {
    cwd: packageRoot,
    env: { ...process.env, ...env },
    input: stdin,
    timeout: 20_000,
    encoding: 'utf8',
  });
  return { stdout: result.stdout ?? '', stderr: result.stderr ?? '', exitCode: result.status ?? 1 };
}

function runHookCli(
  source: string,
  stdinJson: unknown,
  env: Record<string, string>,
): HookCliResult {
  return runHookCliRaw(source, JSON.stringify(stdinJson), env);
}

describe('revealui-harnesses hook <source> (CLI end to end)', () => {
  let dir: string;
  let spoolPath: string;
  let snapshotPath: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'cli-hook-test-'));
    spoolPath = join(dir, 'receipts.jsonl');
    snapshotPath = join(dir, 'policy-snapshot.json');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('allows by default (advisory, no snapshot) and prints the Cursor-native response', () => {
    const result = runHookCli(
      'cursor',
      { hook_event_name: 'stop' },
      { REVEALUI_HOOK_SPOOL_PATH: spoolPath, REVEALUI_POLICY_SNAPSHOT_PATH: snapshotPath },
    );
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout.trim())).toEqual({ permission: 'allow' });
  }, 25_000);

  it('exits 2 and prints a deny response when a valid snapshot denies', async () => {
    await writeFile(
      snapshotPath,
      JSON.stringify({
        version: 1,
        keyId: 'k1',
        signature: 'sig',
        issuedAt: new Date().toISOString(),
        rules: [{ kind: 'pre-shell', permission: 'deny', reason: 'no shells from cli test' }],
      }),
      'utf8',
    );

    const result = runHookCli(
      'cursor',
      { hook_event_name: 'beforeShellExecution', command: 'rm -rf /' },
      { REVEALUI_HOOK_SPOOL_PATH: spoolPath, REVEALUI_POLICY_SNAPSHOT_PATH: snapshotPath },
    );

    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stdout.trim())).toEqual({
      permission: 'deny',
      user_message: 'no shells from cli test',
      agent_message: 'no shells from cli test',
    });
  }, 25_000);

  it('defaults to allow on malformed stdin instead of crashing', () => {
    const result = runHookCliRaw('cursor', 'not valid json {{{', {
      REVEALUI_HOOK_SPOOL_PATH: spoolPath,
      REVEALUI_POLICY_SNAPSHOT_PATH: snapshotPath,
    });
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain('invalid JSON on stdin');
  }, 25_000);

  it('rejects an unsupported source with exit code 1', () => {
    // opencode has no hook normalizer -- OpenCode has no hook system to
    // normalize from (see hooks/normalizers/index.ts's dispatch doc comment).
    const result = runHookCli(
      'opencode',
      { hook_event_name: 'x' },
      { REVEALUI_HOOK_SPOOL_PATH: spoolPath, REVEALUI_POLICY_SNAPSHOT_PATH: snapshotPath },
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Unsupported hook source');
  }, 25_000);

  it('normalizes a VS Code PreToolUse deny and prints the nested hookSpecificOutput response', async () => {
    await writeFile(
      snapshotPath,
      JSON.stringify({
        version: 1,
        keyId: 'k1',
        signature: 'sig',
        issuedAt: new Date().toISOString(),
        rules: [
          { kind: 'pre-shell', permission: 'deny', reason: 'no shells from vscode cli test' },
        ],
      }),
      'utf8',
    );

    const result = runHookCli(
      'vscode',
      {
        hook_event_name: 'PreToolUse',
        tool_name: 'runInTerminal',
        tool_input: { command: 'rm -rf /' },
      },
      { REVEALUI_HOOK_SPOOL_PATH: spoolPath, REVEALUI_POLICY_SNAPSHOT_PATH: snapshotPath },
    );

    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stdout.trim())).toEqual({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: 'no shells from vscode cli test',
      },
    });
  }, 25_000);

  it('allows a VS Code Stop event by default (advisory, no snapshot)', () => {
    const result = runHookCli(
      'vscode',
      { hook_event_name: 'Stop' },
      { REVEALUI_HOOK_SPOOL_PATH: spoolPath, REVEALUI_POLICY_SNAPSHOT_PATH: snapshotPath },
    );
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout.trim())).toEqual({ decision: 'approve' });
  }, 25_000);
});
