/**
 * Hook identity cache — same layout as Claude Studio adapter
 * (`~/.local/share/revealui/hook-identities/<agentId>.json`).
 * Shared so Claude and Grok sessions use one control-layer store.
 */

import { chmodSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface HookIdentity {
  readonly agentId: string;
  readonly did: string;
  readonly fingerprint: string;
  readonly privateKeyPem: string;
  readonly publicKeyPem?: string;
}

export function defaultIdentityDir(): string {
  return (
    process.env.REVDEV_HOOK_IDENTITY_DIR ??
    join(homedir(), '.local', 'share', 'revealui', 'hook-identities')
  );
}

export function parseFingerprint(did: string): string | null {
  const parts = did.split(':');
  if (parts.length < 4 || parts[0] !== 'did' || parts[1] !== 'revfleet') {
    return null;
  }
  return parts[parts.length - 1] || null;
}

function ensureDir(dir: string): void {
  try {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  } catch {
    /* race */
  }
  try {
    chmodSync(dir, 0o700);
  } catch {
    /* non-fatal */
  }
}

function identityPath(dir: string, agentId: string): string {
  if (
    typeof agentId !== 'string' ||
    agentId.length === 0 ||
    agentId.includes('/') ||
    agentId.includes('\\') ||
    agentId.includes('..')
  ) {
    throw new Error(`session-identity: invalid agentId ${agentId}`);
  }
  return join(dir, `${agentId}.json`);
}

export function loadHookIdentity(
  agentId: string,
  dir: string = defaultIdentityDir(),
): HookIdentity | null {
  try {
    const raw = readFileSync(identityPath(dir, agentId), 'utf-8');
    const parsed = JSON.parse(raw) as Partial<HookIdentity>;
    if (
      !parsed ||
      typeof parsed.did !== 'string' ||
      typeof parsed.privateKeyPem !== 'string' ||
      typeof parsed.fingerprint !== 'string'
    ) {
      return null;
    }
    return {
      agentId,
      did: parsed.did,
      fingerprint: parsed.fingerprint,
      privateKeyPem: parsed.privateKeyPem,
      publicKeyPem: typeof parsed.publicKeyPem === 'string' ? parsed.publicKeyPem : undefined,
    };
  } catch {
    return null;
  }
}

export function saveHookIdentity(identity: HookIdentity, dir: string = defaultIdentityDir()): void {
  ensureDir(dir);
  const target = identityPath(dir, identity.agentId);
  const tmp = `${target}.${process.pid}.tmp`;
  const body = `${JSON.stringify(
    {
      agentId: identity.agentId,
      did: identity.did,
      fingerprint: identity.fingerprint,
      privateKeyPem: identity.privateKeyPem,
      publicKeyPem: identity.publicKeyPem ?? null,
      savedAt: new Date().toISOString(),
    },
    null,
    2,
  )}\n`;
  writeFileSync(tmp, body, { encoding: 'utf-8', mode: 0o600 });
  try {
    chmodSync(tmp, 0o600);
  } catch {
    /* non-fatal */
  }
  renameSync(tmp, target);
}

export function resolveAfterRegister(
  reg: {
    agentId: string;
    did?: string;
    publicKeyPem?: string;
    privateKeyPem?: string;
  },
  dir: string = defaultIdentityDir(),
): HookIdentity | null {
  if (!reg.agentId) return null;

  if (reg.privateKeyPem && reg.did) {
    const fingerprint = parseFingerprint(reg.did);
    if (!fingerprint) return null;
    const identity: HookIdentity = {
      agentId: reg.agentId,
      did: reg.did,
      fingerprint,
      privateKeyPem: reg.privateKeyPem,
      publicKeyPem: reg.publicKeyPem,
    };
    try {
      saveHookIdentity(identity, dir);
    } catch {
      /* still return in-memory */
    }
    return identity;
  }

  return loadHookIdentity(reg.agentId, dir);
}

export function clearHookIdentity(agentId: string, dir: string = defaultIdentityDir()): void {
  try {
    unlinkSync(identityPath(dir, agentId));
  } catch {
    /* missing ok */
  }
}

/**
 * Per-process daemon session id cache.
 * Lives under the private RevealUI data dir (0700), not world-writable /tmp
 * (CodeQL insecure temporary file).
 */
export function daemonSessionCacheDir(): string {
  return (
    process.env.REVDEV_DAEMON_SESSION_DIR ??
    join(homedir(), '.local', 'share', 'revealui', 'daemon-sessions')
  );
}

export function daemonSessionCachePath(ppid: number | string = process.ppid): string {
  const safe = String(ppid).replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safe) {
    throw new Error('daemon-session-cache: invalid ppid');
  }
  return join(daemonSessionCacheDir(), `${safe}.id`);
}

export function writeDaemonSessionCache(
  agentId: string,
  ppid: number | string = process.ppid,
): void {
  const dir = daemonSessionCacheDir();
  ensureDir(dir);
  const target = daemonSessionCachePath(ppid);
  const tmp = `${target}.${process.pid}.tmp`;
  writeFileSync(tmp, agentId, { encoding: 'utf-8', mode: 0o600 });
  try {
    chmodSync(tmp, 0o600);
  } catch {
    /* non-fatal */
  }
  renameSync(tmp, target);
  try {
    chmodSync(target, 0o600);
  } catch {
    /* non-fatal */
  }
}

export function readDaemonSessionCache(ppid: number | string = process.ppid): string | null {
  try {
    return readFileSync(daemonSessionCachePath(ppid), 'utf-8').trim() || null;
  } catch {
    return null;
  }
}

export function clearDaemonSessionCache(ppid: number | string = process.ppid): void {
  try {
    unlinkSync(daemonSessionCachePath(ppid));
  } catch {
    /* ok */
  }
}
