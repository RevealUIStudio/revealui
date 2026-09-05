/**
 * Studio-local principal for the knowledge-graph stdio launcher.
 *
 * Reads the same hook-identity files SessionStart writes
 * (`REVDEV_HOOK_IDENTITY_DIR` / `~/.local/share/revealui/hook-identities`).
 * Does not import `@revealui/harnesses` (MCP stays free of the adapter layer).
 */

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  type MemoryHarness,
  type MemoryPrincipal,
  STUDIO_LOCAL_TENANT,
} from '@revealui/knowledge-graph/memory';

const HARNESSES: readonly MemoryHarness[] = [
  'claude',
  'grok',
  'cursor',
  'opencode',
  'revdev',
  'hermes',
  'other',
];

export interface HookIdentity {
  readonly agentId: string;
  readonly did: string;
  readonly fingerprint: string;
}

const warned = new Set<string>();

export function defaultIdentityDir(): string {
  return (
    process.env.REVDEV_HOOK_IDENTITY_DIR ??
    join(homedir(), '.local', 'share', 'revealui', 'hook-identities')
  );
}

export function daemonSessionCacheDir(): string {
  return (
    process.env.REVDEV_DAEMON_SESSION_DIR ??
    join(homedir(), '.local', 'share', 'revealui', 'daemon-sessions')
  );
}

function safeAgentId(agentId: string): boolean {
  return (
    agentId.length > 0 &&
    !agentId.includes('/') &&
    !agentId.includes('\\') &&
    !agentId.includes('..')
  );
}

export function readDaemonSessionCache(ppid: number | string = process.ppid): string | null {
  try {
    const safe = String(ppid).replace(/[^a-zA-Z0-9_-]/g, '');
    if (!safe) return null;
    const raw = readFileSync(join(daemonSessionCacheDir(), `${safe}.id`), 'utf-8').trim();
    return raw || null;
  } catch {
    return null;
  }
}

export function resolveStudioAgentId(): string | null {
  const env = process.env.REVDEV_AGENT_ID?.trim();
  if (env) return env;
  return readDaemonSessionCache(process.ppid);
}

export function loadHookIdentity(
  agentId: string,
  dir: string = defaultIdentityDir(),
): HookIdentity | null {
  if (!safeAgentId(agentId)) return null;
  try {
    const raw = readFileSync(join(dir, `${agentId}.json`), 'utf-8');
    const parsed = JSON.parse(raw) as Partial<HookIdentity> & { privateKeyPem?: string };
    if (
      !(
        parsed &&
        typeof parsed.did === 'string' &&
        typeof parsed.fingerprint === 'string' &&
        typeof parsed.privateKeyPem === 'string'
      )
    ) {
      return null;
    }
    return { agentId, did: parsed.did, fingerprint: parsed.fingerprint };
  } catch {
    return null;
  }
}

export function detectHarness(): MemoryHarness {
  const raw = process.env.REVDEV_HARNESS;
  if (raw && (HARNESSES as readonly string[]).includes(raw)) {
    return raw as MemoryHarness;
  }
  return 'other';
}

export function loadStudioPrincipal(): MemoryPrincipal | null {
  const agentId = resolveStudioAgentId();
  if (!agentId) return null;
  const identity = loadHookIdentity(agentId);
  if (!identity) return null;
  return {
    did: identity.did,
    agentId: identity.agentId,
    fingerprint: identity.fingerprint,
    didKind: 'agent-key',
    harness: detectHarness(),
    tenantId: STUDIO_LOCAL_TENANT,
    trustBoundary: 'studio-local',
    isFleetOperator: true,
  };
}

export function missingPrincipalKey(): string {
  return process.env.REVDEV_AGENT_ID?.trim() || `ppid:${process.ppid}`;
}

export function warnMissingPrincipal(log: { warning(msg: string): void }): void {
  const key = missingPrincipalKey();
  if (warned.has(key)) return;
  warned.add(key);
  log.warning(
    '[durable-memory] knowledge graph principal missing. Proceeding without durable memory.',
  );
}

/** Test-only: clear the once-per-process warn set. */
export function resetMissingPrincipalWarnings(): void {
  warned.clear();
}
