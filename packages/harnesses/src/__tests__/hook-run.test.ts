import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runHookCommand } from '../hooks/run-hook.js';

describe('runHookCommand', () => {
  let dir: string;
  let spoolPath: string;
  let snapshotPath: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'run-hook-test-'));
    spoolPath = join(dir, 'receipts.jsonl');
    snapshotPath = join(dir, 'policy-snapshot.json');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('I-5: a missing policy snapshot degrades to advisory and allows', async () => {
    const result = await runHookCommand(
      'cursor',
      { hook_event_name: 'beforeShellExecution', command: 'rm -rf /' },
      { spoolPath, snapshotPath },
    );
    expect(result.event.enforcementTier).toBe('advisory');
    expect(result.decision.permission).toBe('allow');
    expect(result.responseJson).toEqual({ permission: 'allow' });
    expect(result.exitCode).toBe(0);
  });

  it('I-5: an invalid (tampered) policy snapshot also degrades to advisory', async () => {
    await writeFile(snapshotPath, 'not valid json at all', 'utf8');
    const result = await runHookCommand(
      'cursor',
      { hook_event_name: 'beforeShellExecution', command: 'rm -rf /' },
      { spoolPath, snapshotPath },
    );
    expect(result.event.enforcementTier).toBe('advisory');
    expect(result.decision.permission).toBe('allow');
  });

  it('I-5: a structurally valid snapshot applies its deny rule but records advisory until the signature is verified', async () => {
    await writeFile(
      snapshotPath,
      JSON.stringify({
        version: 1,
        keyId: 'k1',
        signature: 'sig-placeholder',
        issuedAt: new Date().toISOString(),
        rules: [{ kind: 'pre-shell', permission: 'deny', reason: 'shells are denied by policy' }],
      }),
      'utf8',
    );

    const result = await runHookCommand(
      'cursor',
      { hook_event_name: 'beforeShellExecution', command: 'rm -rf /' },
      { spoolPath, snapshotPath },
    );

    // The deny rule STILL applies (defense in depth -- policy can only tighten),
    // but the receipt must NOT claim `enforced`: the signature is a placeholder
    // and nothing cryptographically verified it (design invariant I-5). Reporting
    // `enforced` here would be the exact overclaim the invariant forbids.
    expect(result.decision.permission).toBe('deny');
    expect(result.exitCode).toBe(2);
    expect(result.event.enforcementTier).toBe('advisory');
    expect(result.responseJson).toEqual({
      permission: 'deny',
      user_message: 'shells are denied by policy',
      agent_message: 'shells are denied by policy',
    });
  });

  it('builds the claude-code-native response shape on deny/ask/allow', async () => {
    await writeFile(
      snapshotPath,
      JSON.stringify({
        version: 1,
        keyId: 'k1',
        signature: 'sig',
        issuedAt: new Date().toISOString(),
        rules: [{ kind: 'pre-shell', permission: 'deny', reason: 'no shells' }],
      }),
      'utf8',
    );

    const denied = await runHookCommand(
      'claude-code',
      { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'ls' } },
      { spoolPath, snapshotPath },
    );
    expect(denied.responseJson).toEqual({ decision: 'block', reason: 'no shells' });
    expect(denied.exitCode).toBe(2);

    const allowed = await runHookCommand(
      'claude-code',
      { hook_event_name: 'PreToolUse', tool_name: 'Read' },
      { spoolPath, snapshotPath },
    );
    expect(allowed.responseJson).toEqual({ decision: 'approve' });
    expect(allowed.exitCode).toBe(0);
  });

  it('spools every decision to the configured path', async () => {
    await runHookCommand(
      'cursor',
      { hook_event_name: 'sessionStart', conversation_id: 'c1' },
      { spoolPath, snapshotPath },
    );
    await runHookCommand(
      'cursor',
      { hook_event_name: 'stop', conversation_id: 'c1' },
      { spoolPath, snapshotPath },
    );

    const content = await readFile(spoolPath, 'utf8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0] as string).event.kind).toBe('session-start');
    expect(JSON.parse(lines[1] as string).event.kind).toBe('stop');
  });

  // Design invariant I-1: a forged identity field in the hook payload never
  // appears in the normalized identity, and cannot widen or change the
  // policy outcome (a deny rule scoped by tool/kind still fires regardless
  // of what identity the payload claims).
  it('I-1: a forged identity claim never appears in normalized identity nor changes the policy outcome', async () => {
    await writeFile(
      snapshotPath,
      JSON.stringify({
        version: 1,
        keyId: 'k1',
        signature: 'sig',
        issuedAt: new Date().toISOString(),
        rules: [{ toolName: 'DangerousTool', permission: 'deny', reason: 'blocked tool' }],
      }),
      'utf8',
    );

    const honest = await runHookCommand(
      'cursor',
      {
        hook_event_name: 'preToolUse',
        tool_name: 'DangerousTool',
        user_email: 'real-user@example.com',
      },
      { spoolPath, snapshotPath },
    );

    const forged = await runHookCommand(
      'cursor',
      {
        hook_event_name: 'preToolUse',
        tool_name: 'DangerousTool',
        // Claims to be a different, privileged-sounding identity.
        user_email: 'admin@revealui.com',
        conversation_id: 'someone-elses-conversation',
      },
      { spoolPath, snapshotPath },
    );

    // Same deny outcome regardless of the claimed identity.
    expect(honest.decision.permission).toBe('deny');
    expect(forged.decision.permission).toBe('deny');
    expect(forged.decision.reason).toBe(honest.decision.reason);

    // The forged email never lands on the normalized identity.
    expect(forged.event.identity).not.toHaveProperty('email');
    expect(forged.event.identity).not.toHaveProperty('userEmail');
    expect(Object.values(forged.event.identity)).not.toContain('admin@revealui.com');

    // It is still visible in raw (display metadata only).
    expect((forged.event.raw as { user_email: string }).user_email).toBe('admin@revealui.com');
  });
});
