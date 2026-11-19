import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fingerprintAgentKey } from '@revealui/knowledge-graph/memory';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectHarness, loadHookIdentity } from '../src/servers/_kg-principal.js';

const roots: string[] = [];
afterEach(() => {
  vi.unstubAllEnvs();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'studio-principal-'));
  roots.push(root);
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const fingerprint = fingerprintAgentKey(
    publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  );
  const record = {
    agentId: 'codex-test',
    did: `did:revealfleet:codex-test:${fingerprint}`,
    fingerprint,
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  };
  const write = (overrides: Record<string, unknown> = {}) =>
    writeFileSync(join(root, 'codex-test.json'), JSON.stringify({ ...record, ...overrides }));
  return { root, record, write };
}
describe('studio-local key-backed principal', () => {
  it('recognizes Codex and exposes only verified public identity fields', () => {
    vi.stubEnv('REVDEV_HARNESS', 'codex');
    expect(detectHarness()).toBe('codex');
    const { root, record, write } = fixture();
    write();
    expect(loadHookIdentity('codex-test', root)).toEqual({
      agentId: record.agentId,
      did: record.did,
      fingerprint: record.fingerprint,
    });
  });
  it.each(['did', 'fingerprint', 'privateKeyPem'])(
    'rejects inconsistent or invalid %s',
    (field) => {
      const { root, write } = fixture();
      write({ [field]: 'invalid' });
      expect(loadHookIdentity('codex-test', root)).toBeNull();
    },
  );
  it('rejects a different valid private key and absent/path-traversal identities', () => {
    const { root, write } = fixture();
    const { privateKey } = generateKeyPairSync('ed25519');
    write({ privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() });
    expect(loadHookIdentity('codex-test', root)).toBeNull();
    expect(loadHookIdentity('absent', root)).toBeNull();
    expect(loadHookIdentity('../codex-test', root)).toBeNull();
  });
});
