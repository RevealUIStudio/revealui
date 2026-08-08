import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { normalizeCursorHookEvent } from '../hooks/normalizers/cursor.js';
import { evaluatePolicy, loadPolicySnapshot } from '../hooks/policy.js';

describe('loadPolicySnapshot', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'hook-policy-test-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('reports "missing" when the file does not exist', async () => {
    const result = await loadPolicySnapshot(join(dir, 'does-not-exist.json'));
    expect(result.valid).toBe(false);
    expect(!result.valid && result.reason).toBe('missing');
  });

  it('reports "invalid-json" for unparseable content', async () => {
    const path = join(dir, 'snapshot.json');
    await writeFile(path, 'not json{{{', 'utf8');
    const result = await loadPolicySnapshot(path);
    expect(result.valid).toBe(false);
    expect(!result.valid && result.reason).toBe('invalid-json');
  });

  it('reports "invalid-shape" for JSON missing required fields', async () => {
    const path = join(dir, 'snapshot.json');
    await writeFile(path, JSON.stringify({ version: 1 }), 'utf8');
    const result = await loadPolicySnapshot(path);
    expect(result.valid).toBe(false);
    expect(!result.valid && result.reason).toBe('invalid-shape');
  });

  it('reports "invalid-shape" for a tampered signature field (wrong type)', async () => {
    const path = join(dir, 'snapshot.json');
    await writeFile(
      path,
      JSON.stringify({
        version: 1,
        keyId: 'k1',
        signature: 12345, // tampered: should be a string
        issuedAt: new Date().toISOString(),
        rules: [],
      }),
      'utf8',
    );
    const result = await loadPolicySnapshot(path);
    expect(result.valid).toBe(false);
    expect(!result.valid && result.reason).toBe('invalid-shape');
  });

  it('loads a structurally well-formed unsigned snapshot without cryptoVerified', async () => {
    const path = join(dir, 'snapshot.json');
    const snapshot = {
      version: 1,
      keyId: 'unsigned-structure-only',
      signature: 'unsigned',
      issuedAt: new Date().toISOString(),
      rules: [{ source: 'cursor', kind: 'pre-shell', permission: 'deny', reason: 'no shell' }],
    };
    await writeFile(path, JSON.stringify(snapshot), 'utf8');
    const result = await loadPolicySnapshot(path);
    expect(result.valid).toBe(true);
    expect(result.valid && result.cryptoVerified).toBe(false);
    expect(result.valid && result.snapshot.rules).toHaveLength(1);
  });

  it('loads a structure-only signed-looking snapshot as not cryptoVerified without public key', async () => {
    const path = join(dir, 'snapshot.json');
    const snapshot = {
      version: 1,
      keyId: 'k1',
      signature: 'sig-placeholder',
      issuedAt: new Date().toISOString(),
      rules: [{ source: 'cursor', kind: 'pre-shell', permission: 'deny', reason: 'no shell' }],
    };
    await writeFile(path, JSON.stringify(snapshot), 'utf8');
    const prev = {
      policy: process.env.REVEALUI_POLICY_PUBLIC_KEY,
      audit: process.env.REVEALUI_AUDIT_PUBLIC_KEY,
      policyPriv: process.env.REVEALUI_POLICY_SIGNING_KEY,
      auditPriv: process.env.REVEALUI_AUDIT_SIGNING_KEY,
    };
    delete process.env.REVEALUI_POLICY_PUBLIC_KEY;
    delete process.env.REVEALUI_AUDIT_PUBLIC_KEY;
    delete process.env.REVEALUI_POLICY_SIGNING_KEY;
    delete process.env.REVEALUI_AUDIT_SIGNING_KEY;
    try {
      const result = await loadPolicySnapshot(path);
      expect(result.valid).toBe(true);
      expect(result.valid && result.cryptoVerified).toBe(false);
    } finally {
      if (prev.policy) process.env.REVEALUI_POLICY_PUBLIC_KEY = prev.policy;
      if (prev.audit) process.env.REVEALUI_AUDIT_PUBLIC_KEY = prev.audit;
      if (prev.policyPriv) process.env.REVEALUI_POLICY_SIGNING_KEY = prev.policyPriv;
      if (prev.auditPriv) process.env.REVEALUI_AUDIT_SIGNING_KEY = prev.auditPriv;
    }
  });
});

describe('evaluatePolicy', () => {
  const shellEvent = normalizeCursorHookEvent(
    { hook_event_name: 'beforeShellExecution', command: 'rm -rf /' },
    'advisory',
  );

  it('allows everything when the snapshot is invalid (advisory mode)', () => {
    const decision = evaluatePolicy({ valid: false, reason: 'missing' }, shellEvent);
    expect(decision.permission).toBe('allow');
  });

  it('denies when a rule matches on kind', () => {
    const decision = evaluatePolicy(
      {
        valid: true,
        cryptoVerified: false,
        snapshot: {
          version: 1,
          keyId: 'k1',
          signature: 'sig',
          issuedAt: new Date().toISOString(),
          rules: [{ kind: 'pre-shell', permission: 'deny', reason: 'shells are denied' }],
        },
      },
      shellEvent,
    );
    expect(decision.permission).toBe('deny');
    expect(decision.reason).toBe('shells are denied');
  });

  it('allows when no rule matches', () => {
    const decision = evaluatePolicy(
      {
        valid: true,
        cryptoVerified: false,
        snapshot: {
          version: 1,
          keyId: 'k1',
          signature: 'sig',
          issuedAt: new Date().toISOString(),
          rules: [{ kind: 'file-edit', permission: 'deny', reason: 'no edits' }],
        },
      },
      shellEvent,
    );
    expect(decision.permission).toBe('allow');
  });

  it('scopes a rule by source + toolName together', () => {
    const toolEvent = normalizeCursorHookEvent(
      { hook_event_name: 'preToolUse', tool_name: 'DangerousTool' },
      'advisory',
    );
    const snapshot = {
      version: 1,
      keyId: 'k1',
      signature: 'sig',
      issuedAt: new Date().toISOString(),
      rules: [
        {
          source: 'cursor' as const,
          toolName: 'DangerousTool',
          permission: 'ask' as const,
          reason: 'confirm before running',
        },
      ],
    };
    expect(
      evaluatePolicy({ valid: true, cryptoVerified: false, snapshot }, toolEvent).permission,
    ).toBe('ask');

    const otherTool = normalizeCursorHookEvent(
      { hook_event_name: 'preToolUse', tool_name: 'SafeTool' },
      'advisory',
    );
    expect(
      evaluatePolicy({ valid: true, cryptoVerified: false, snapshot }, otherTool).permission,
    ).toBe('allow');
  });
});
