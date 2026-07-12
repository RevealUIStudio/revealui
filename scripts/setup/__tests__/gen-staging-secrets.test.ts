import { describe, expect, it, vi } from 'vitest';
import {
  buildEntries,
  describeShape,
  generateVerifiedLicenseKeypair,
  parseCliFlags,
  runGenerator,
  type SecretEntry,
} from '../gen-staging-secrets.js';

describe('parseCliFlags', () => {
  it('defaults everything off with no args', () => {
    expect(parseCliFlags([])).toEqual({ dryRun: false, force: false, help: false });
  });

  it('reads --dry-run, --force, --help independently', () => {
    expect(parseCliFlags(['--dry-run'])).toEqual({ dryRun: true, force: false, help: false });
    expect(parseCliFlags(['--force'])).toEqual({ dryRun: false, force: true, help: false });
    expect(parseCliFlags(['--dry-run', '--force'])).toEqual({
      dryRun: true,
      force: true,
      help: false,
    });
    expect(parseCliFlags(['-h'])).toEqual({ dryRun: false, force: false, help: true });
  });
});

describe('describeShape', () => {
  it('never echoes the value - only length/kind', () => {
    const entry: SecretEntry = { path: 'x', shape: 'hex-64', value: 'a'.repeat(64) };
    const shape = describeShape(entry);
    expect(shape).not.toContain('a'.repeat(64));
    expect(shape).toContain('64');
  });

  it('describes each shape kind distinctly', () => {
    expect(describeShape({ shape: 'hex-64', value: 'f'.repeat(64) })).toBe(
      '64 lowercase hex chars',
    );
    expect(describeShape({ shape: 'hex-random', value: 'f'.repeat(48) })).toBe(
      '48 lowercase hex chars',
    );
    expect(describeShape({ shape: 'literal', value: 'staging.revealui.com' })).toBe(
      'literal string, 20 chars',
    );
    expect(describeShape({ shape: 'pem-private-ed25519', value: 'line1\nline2\nline3' })).toBe(
      'PKCS8 Ed25519 private key PEM (3 lines)',
    );
    expect(describeShape({ shape: 'pem-public-ed25519', value: 'line1\nline2\nline3' })).toBe(
      'SPKI Ed25519 public key PEM (3 lines)',
    );
  });
});

describe('generateVerifiedLicenseKeypair', () => {
  it('produces a PKCS8 private PEM + SPKI public PEM that self-verify', async () => {
    const { privateKey, publicKey } = await generateVerifiedLicenseKeypair();
    expect(privateKey).toContain('BEGIN PRIVATE KEY');
    expect(publicKey).toContain('BEGIN PUBLIC KEY');
  });

  it('two calls produce two DIFFERENT keypairs (fresh each time)', async () => {
    const first = await generateVerifiedLicenseKeypair();
    const second = await generateVerifiedLicenseKeypair();
    expect(first.privateKey).not.toBe(second.privateKey);
    expect(first.publicKey).not.toBe(second.publicKey);
  });
});

describe('buildEntries', () => {
  it('includes the full generate-fresh bucket under revealui/staging/*, no duplicate paths', async () => {
    const entries = await buildEntries();
    const paths = entries.map((e) => e.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths.length).toBeGreaterThan(10);
    for (const path of paths) {
      expect(path.startsWith('revealui/staging/')).toBe(true);
    }
    expect(paths).toContain('revealui/staging/kek');
    expect(paths).toContain('revealui/staging/secret');
    expect(paths).toContain('revealui/staging/cron-secret');
    expect(paths).toContain('revealui/staging/audit-hmac-secret');
    expect(paths).toContain('revealui/staging/admin/api-key');
    expect(paths).toContain('revealui/staging/license/private-key');
    expect(paths).toContain('revealui/staging/license/public-key');
    expect(paths).toContain('revealui/staging/session-cookie-domain');
    expect(paths).toContain('revealui/staging/passkey/rp-id');
    expect(paths).toContain('revealui/staging/passkey/origin');
    expect(paths).toContain('revealui/staging/passkey/rp-name');
    expect(paths).toContain('revealui/staging/cors-origin');
    expect(paths).toContain('revealui/staging/public/server-url');
    expect(paths).toContain('revealui/staging/public/api-url');
  });

  it('never includes the owner-set-by-hand paths (alert-email, admin email/password)', async () => {
    const paths = (await buildEntries()).map((e) => e.path);
    expect(paths).not.toContain('revealui/staging/alert-email');
    expect(paths).not.toContain('revealui/staging/admin/email');
    expect(paths).not.toContain('revealui/staging/admin/password');
  });

  it('REVEALUI_KEK-shaped value is exactly 64 hex chars (validate-startup.ts format)', async () => {
    const kek = (await buildEntries()).find((e) => e.path === 'revealui/staging/kek');
    expect(kek?.value).toHaveLength(64);
    expect(kek?.value).toMatch(/^[0-9a-f]+$/);
  });

  it('the >=32-char secrets meet the validate-startup.ts minimum length', async () => {
    const entries = await buildEntries();
    for (const path of [
      'revealui/staging/secret',
      'revealui/staging/cron-secret',
      'revealui/staging/audit-hmac-secret',
    ]) {
      const entry = entries.find((e) => e.path === path);
      expect(entry?.value.length ?? 0, path).toBeGreaterThanOrEqual(32);
    }
  });

  it('the deterministic URL values honor the amended-B staging.revealui.com subtree', async () => {
    const entries = await buildEntries();
    const byPath = new Map(entries.map((e) => [e.path, e.value]));
    expect(byPath.get('revealui/staging/session-cookie-domain')).toBe('staging.revealui.com');
    expect(byPath.get('revealui/staging/passkey/rp-id')).toBe('staging.revealui.com');
    expect(byPath.get('revealui/staging/passkey/origin')).toBe(
      'https://admin.staging.revealui.com',
    );
    // server-url == passkey/origin (both the admin app's own origin) per the
    // fleet convention this script's header documents.
    expect(byPath.get('revealui/staging/public/server-url')).toBe(
      byPath.get('revealui/staging/passkey/origin'),
    );
    expect(byPath.get('revealui/staging/public/api-url')).toBe('https://api.staging.revealui.com');
    expect(byPath.get('revealui/staging/cors-origin')).toBe(
      'https://staging.revealui.com,https://admin.staging.revealui.com',
    );
  });
});

describe('runGenerator', () => {
  const entries: SecretEntry[] = [
    { path: 'revealui/staging/a', shape: 'hex-random', value: 'secretvalue-a' },
    { path: 'revealui/staging/b', shape: 'literal', value: 'secretvalue-b' },
  ];

  it('dry-run makes zero calls to exists/write and never logs a value', () => {
    const exists = vi.fn(() => true);
    const write = vi.fn();
    const lines: string[] = [];
    const result = runGenerator(entries, {
      dryRun: true,
      force: false,
      exists,
      write,
      log: (line) => lines.push(line),
    });
    expect(exists).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(result.written).toEqual(['revealui/staging/a', 'revealui/staging/b']);
    for (const line of lines) {
      expect(line).not.toContain('secretvalue-a');
      expect(line).not.toContain('secretvalue-b');
    }
  });

  it('skips an existing path without --force, writes it with --force', () => {
    const exists = vi.fn(() => true);
    const write = vi.fn();
    const skipped = runGenerator(entries, {
      dryRun: false,
      force: false,
      exists,
      write,
      log: () => {},
    });
    expect(skipped.skipped).toEqual(['revealui/staging/a', 'revealui/staging/b']);
    expect(write).not.toHaveBeenCalled();

    const forced = runGenerator(entries, {
      dryRun: false,
      force: true,
      exists,
      write,
      log: () => {},
    });
    expect(forced.written).toEqual(['revealui/staging/a', 'revealui/staging/b']);
    expect(write).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenCalledWith('revealui/staging/a', 'secretvalue-a');
  });

  it('writes a fresh (non-existing) path without needing --force', () => {
    const exists = vi.fn(() => false);
    const write = vi.fn();
    const result = runGenerator(entries, {
      dryRun: false,
      force: false,
      exists,
      write,
      log: () => {},
    });
    expect(result.written).toEqual(['revealui/staging/a', 'revealui/staging/b']);
    expect(write).toHaveBeenCalledTimes(2);
  });

  it('collects a per-path write failure instead of throwing', () => {
    const exists = vi.fn(() => false);
    const write = vi.fn(() => {
      throw new Error('revvault set failed');
    });
    const result = runGenerator(entries, {
      dryRun: false,
      force: false,
      exists,
      write,
      log: () => {},
    });
    expect(result.failed).toEqual(['revealui/staging/a', 'revealui/staging/b']);
    expect(result.written).toEqual([]);
  });
});
