import { generateKeyPairSync, verify } from 'node:crypto';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { coldDaemonSessionsDir } from '../session/archive-exit.js';
import {
  hashParams,
  openRuntimeSession,
  sessionEnd,
  sessionRegister,
  signRpc,
} from '../session/index.js';

describe('session boundary (soft-optional daemon)', () => {
  const dirs: string[] = [];
  const servers: Array<ReturnType<typeof createServer>> = [];

  afterEach(async () => {
    for (const s of servers) {
      await new Promise<void>((resolve) => s.close(() => resolve()));
    }
    servers.length = 0;
    for (const d of dirs) {
      rmSync(d, { recursive: true, force: true });
    }
    dirs.length = 0;
  });

  it('uses only the canonical archive setting', () => {
    const retiredArchiveKey = ['REV', 'FLEET'].join('') + '_ARCHIVE';
    const canonical = process.env.REVEALFLEET_ARCHIVE;
    const legacy = process.env[retiredArchiveKey];
    try {
      delete process.env.REVEALFLEET_ARCHIVE;
      process.env[retiredArchiveKey] = '/ignored-legacy-archive';
      expect(coldDaemonSessionsDir()).toBe(
        join(homedir(), 'revealfleet', 'archive', 'cold', 'sessions', 'daemon'),
      );
      process.env.REVEALFLEET_ARCHIVE = '/canonical/cold';
      expect(coldDaemonSessionsDir()).toBe(join('/canonical/cold', 'sessions', 'daemon'));
      process.env.REVEALFLEET_ARCHIVE = '/canonical/archive';
      expect(coldDaemonSessionsDir()).toBe(
        join('/canonical/archive', 'cold', 'sessions', 'daemon'),
      );
    } finally {
      if (canonical === undefined) delete process.env.REVEALFLEET_ARCHIVE;
      else process.env.REVEALFLEET_ARCHIVE = canonical;
      if (legacy === undefined) delete process.env[retiredArchiveKey];
      else process.env[retiredArchiveKey] = legacy;
    }
  });

  it('skips register when socket absent', async () => {
    const result = await sessionRegister({
      backend: 'grok',
      socketPath: join(tmpdir(), `no-such-sock-${Date.now()}`),
    });
    expect(result.skipped).toBe(true);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/absent/i);
  });

  it('archives on end even when socket absent (skipArchive false)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sess-arch-'));
    dirs.push(dir);
    process.env.REVEALFLEET_ARCHIVE = join(dir, 'archive');
    process.env.REVDEV_DAEMON_SESSION_DIR = join(dir, 'sessions');
    process.env.REVDEV_HOOK_IDENTITY_DIR = join(dir, 'ids');
    const { writeDaemonSessionCache } = await import('../session/identity-cache.js');
    writeDaemonSessionCache('archived-agent-1', 'ppid-arch');
    const ended = await sessionEnd({
      socketPath: join(dir, 'no.sock'),
      ppid: 'ppid-arch',
      exitSummary: 'test-archive',
      backend: 'test',
    });
    expect(ended.skipped).toBe(true);
    const { existsSync, readdirSync } = await import('node:fs');
    const cold = join(dir, 'archive', 'cold', 'sessions', 'daemon');
    expect(existsSync(cold)).toBe(true);
    const files = readdirSync(cold).filter((f) => f.endsWith('.json'));
    expect(files.length).toBeGreaterThanOrEqual(1);
    delete process.env.REVEALFLEET_ARCHIVE;
    delete process.env.REVDEV_DAEMON_SESSION_DIR;
    delete process.env.REVDEV_HOOK_IDENTITY_DIR;
  });

  it('registers and ends against a mock daemon with signing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sess-bound-'));
    dirs.push(dir);
    const sock = join(dir, 'harness.sock');
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const agentId = 'grok-test-agent-1';
    const did = `did:revealfleet:${agentId}:fpdeadbeef`;

    process.env.REVDEV_HOOK_IDENTITY_DIR = join(dir, 'ids');
    process.env.REVDEV_DAEMON_SESSION_DIR = join(dir, 'sessions');

    const server = createServer((socket) => {
      let buf = '';
      socket.on('data', (chunk) => {
        buf += chunk.toString();
        if (!buf.includes('\n')) return;
        const line = buf.split('\n')[0]!;
        const req = JSON.parse(line) as {
          id: number;
          method: string;
          params?: Record<string, unknown>;
          'x-revdev-signature'?: string;
        };
        if (req.method === 'session.register') {
          socket.write(
            `${JSON.stringify({
              jsonrpc: '2.0',
              id: req.id,
              result: {
                agentId,
                sessionId: agentId,
                did,
                publicKeyPem,
                privateKeyPem,
              },
            })}\n`,
          );
        } else if (req.method === 'session.end') {
          if (!req['x-revdev-signature']) {
            socket.write(
              `${JSON.stringify({
                jsonrpc: '2.0',
                id: req.id,
                error: { code: -32000, message: 'signature required' },
              })}\n`,
            );
          } else {
            socket.write(
              `${JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { ended: true } })}\n`,
            );
          }
        } else {
          socket.write(
            `${JSON.stringify({
              jsonrpc: '2.0',
              id: req.id,
              error: { message: `unknown ${req.method}` },
            })}\n`,
          );
        }
      });
    });
    servers.push(server);
    await new Promise<void>((resolve, reject) => {
      server.listen(sock, () => resolve());
      server.on('error', reject);
    });

    const reg = await sessionRegister({
      backend: 'grok',
      socketPath: sock,
      agentId,
      ppid: 'testppid',
    });
    expect(reg.ok).toBe(true);
    expect(reg.agentId).toBe(agentId);

    const ended = await sessionEnd({
      socketPath: sock,
      ppid: 'testppid',
      skipArchive: true,
    });
    expect(ended.ok).toBe(true);
    expect(ended.agentId).toBe(agentId);

    delete process.env.REVDEV_HOOK_IDENTITY_DIR;
    delete process.env.REVDEV_DAEMON_SESSION_DIR;
  });

  it.each([false, true])(
    'isolates runtime identity storage and clears it on end (daemon absent: %s)',
    async (absentOnEnd) => {
      const dir = mkdtempSync(join(tmpdir(), 'runtime-boundary-'));
      dirs.push(dir);
      const socketPath = join(dir, 'daemon.sock');
      const identityDir = join(dir, 'identities'),
        sessionDir = join(dir, 'sessions');
      const { privateKey, publicKey } = generateKeyPairSync('ed25519');
      const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
      let ended = 0;
      let expectedAgent = '';
      const server = createServer((socket) => {
        socket.once('data', (chunk) => {
          const request = JSON.parse(chunk.toString());
          let result: unknown = {};
          if (request.method === 'session.register') {
            expectedAgent = request.params.agentId;
            expect(request.params.pid).toBe(process.pid);
            result = {
              agentId: expectedAgent,
              did: `did:revealfleet:${expectedAgent}:fingerprint`,
              privateKeyPem,
            };
          } else {
            const [header, payload, signature] = request['x-revdev-signature'].split('.');
            expect(
              verify(
                null,
                Buffer.from(`${header}.${payload}`),
                publicKey,
                Buffer.from(signature, 'base64url'),
              ),
            ).toBe(true);
            expect(JSON.parse(Buffer.from(payload, 'base64url').toString()).paramsHash).toBe(
              hashParams('session.end', request.params),
            );
            ended++;
          }
          socket.end(`${JSON.stringify({ id: request.id, result })}\n`);
        });
      });
      servers.push(server);
      await new Promise<void>((resolve) => server.listen(socketPath, resolve));
      const lease = await openRuntimeSession('codex', dir, {
        socketPath: absentOnEnd ? 'daemon.sock' : socketPath,
        identityDir: absentOnEnd ? 'identities' : identityDir,
        sessionDir: absentOnEnd ? 'sessions' : sessionDir,
        archiveDir: absentOnEnd ? 'archive' : join(dir, 'archive'),
      });
      expect(lease.ok).toBe(true);
      expect(lease.identityDir).toBe(identityDir);
      expect(lease.identity?.agentId).toBe(expectedAgent);
      expect(lease.identity).not.toHaveProperty('privateKeyPem');
      expect(existsSync(join(identityDir, `${expectedAgent}.json`))).toBe(true);
      expect(readdirSync(sessionDir)).toHaveLength(1);
      if (absentOnEnd) {
        await new Promise<void>((resolve) => server.close(() => resolve()));
        servers.splice(servers.indexOf(server), 1);
      }
      await Promise.all([lease.close(), lease.close()]);
      expect(readdirSync(sessionDir)).toHaveLength(0);
      expect(readdirSync(identityDir)).toHaveLength(0);
      expect(ended).toBe(absentOnEnd ? 0 : 1);
    },
  );

  it('signRpc produces three base64url segments', () => {
    const { privateKey } = generateKeyPairSync('ed25519');
    const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const sig = signRpc(
      {
        did: 'did:revealfleet:a:fp',
        fingerprint: 'fp',
        privateKeyPem,
      },
      'session.end',
      { actorAgentId: 'a' },
    );
    expect(sig.split('.')).toHaveLength(3);
    expect(hashParams('session.end', { actorAgentId: 'a' }).length).toBeGreaterThan(4);
  });
});
