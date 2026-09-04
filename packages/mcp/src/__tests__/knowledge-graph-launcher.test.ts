/**
 * Stdio launcher for knowledge-graph: principal loading, once-per-process
 * warn, import must not process.exit, CLI allowlist names the server.
 */

import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  loadHookIdentity,
  loadStudioPrincipal,
  resetMissingPrincipalWarnings,
  resolveStudioAgentId,
  warnMissingPrincipal,
} from '../servers/kg-principal.js';

const envKeys = [
  'REVDEV_AGENT_ID',
  'REVDEV_HOOK_IDENTITY_DIR',
  'REVDEV_DAEMON_SESSION_DIR',
  'REVDEV_HARNESS',
] as const;

const envSnapshot: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of envKeys) {
    envSnapshot[key] = process.env[key];
    delete process.env[key];
  }
  resetMissingPrincipalWarnings();
});

afterEach(() => {
  for (const key of envKeys) {
    const value = envSnapshot[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function writeIdentity(dir: string, agentId: string): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, `${agentId}.json`),
    JSON.stringify({
      agentId,
      did: `did:revfleet:${agentId}:fpabc`,
      fingerprint: 'fpabc',
      privateKeyPem: 'test-placeholder-not-a-key',
    }),
    'utf-8',
  );
}

describe('resolveStudioAgentId', () => {
  it('prefers REVDEV_AGENT_ID over the daemon session cache', () => {
    const cacheDir = mkdtempSync(join(tmpdir(), 'kg-daemon-'));
    process.env.REVDEV_DAEMON_SESSION_DIR = cacheDir;
    writeFileSync(join(cacheDir, `${process.ppid}.id`), 'from-cache', 'utf-8');
    process.env.REVDEV_AGENT_ID = 'from-env';
    expect(resolveStudioAgentId()).toBe('from-env');
  });

  it('falls back to the daemon session cache when env is unset', () => {
    const cacheDir = mkdtempSync(join(tmpdir(), 'kg-daemon-'));
    process.env.REVDEV_DAEMON_SESSION_DIR = cacheDir;
    writeFileSync(join(cacheDir, `${process.ppid}.id`), 'cached-agent', 'utf-8');
    expect(resolveStudioAgentId()).toBe('cached-agent');
  });
});

describe('loadStudioPrincipal', () => {
  it('returns null when no agent id and no identity file exist', () => {
    process.env.REVDEV_HOOK_IDENTITY_DIR = mkdtempSync(join(tmpdir(), 'kg-id-'));
    process.env.REVDEV_DAEMON_SESSION_DIR = mkdtempSync(join(tmpdir(), 'kg-daemon-'));
    expect(loadStudioPrincipal()).toBeNull();
  });

  it('loads a hook-identity file for REVDEV_AGENT_ID', () => {
    const dir = mkdtempSync(join(tmpdir(), 'kg-id-'));
    writeIdentity(dir, 'grok-1');
    process.env.REVDEV_HOOK_IDENTITY_DIR = dir;
    process.env.REVDEV_AGENT_ID = 'grok-1';
    process.env.REVDEV_HARNESS = 'grok';
    const principal = loadStudioPrincipal();
    expect(principal).toEqual({
      did: 'did:revfleet:grok-1:fpabc',
      agentId: 'grok-1',
      fingerprint: 'fpabc',
      didKind: 'agent-key',
      harness: 'grok',
      tenantId: 'studio-local',
      trustBoundary: 'studio-local',
      isFleetOperator: true,
    });
  });

  it('rejects path-like agent ids', () => {
    expect(loadHookIdentity('../etc/passwd')).toBeNull();
  });
});

describe('warnMissingPrincipal', () => {
  it('logs once per process key', () => {
    process.env.REVDEV_AGENT_ID = 'warn-once';
    const warning = vi.fn();
    warnMissingPrincipal({ warning });
    warnMissingPrincipal({ warning });
    expect(warning).toHaveBeenCalledTimes(1);
  });
});

describe('knowledge-graph launcher import', () => {
  it('does not process.exit on import', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit unexpectedly called with ${code}`);
    }) as never);
    try {
      await import('../servers/knowledge-graph.js');
      await new Promise((r) => setTimeout(r, 50));
      expect(exitSpy).not.toHaveBeenCalled();
    } finally {
      exitSpy.mockRestore();
    }
  });
});

describe('revealui-mcp allowlist', () => {
  it('lists knowledge-graph as a static server name', () => {
    const cli = readFileSync(new URL('../cli.ts', import.meta.url), 'utf8');
    expect(cli).toMatch(/['"]knowledge-graph['"]/);
    expect(cli).toMatch(/launchKnowledgeGraphMcp/);
  });
});
