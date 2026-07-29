import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { hashParams, sessionEnd, sessionRegister, signRpc } from '../session/index.js';

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

  it('skips register when socket absent', async () => {
    const result = await sessionRegister({
      backend: 'grok',
      socketPath: join(tmpdir(), `no-such-sock-${Date.now()}`),
    });
    expect(result.skipped).toBe(true);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/absent/i);
  });

  it('registers and ends against a mock daemon with signing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sess-bound-'));
    dirs.push(dir);
    const sock = join(dir, 'harness.sock');
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const agentId = 'grok-test-agent-1';
    const did = `did:revfleet:${agentId}:fpdeadbeef`;

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
    });
    expect(ended.ok).toBe(true);
    expect(ended.agentId).toBe(agentId);

    delete process.env.REVDEV_HOOK_IDENTITY_DIR;
    delete process.env.REVDEV_DAEMON_SESSION_DIR;
  });

  it('signRpc produces three base64url segments', () => {
    const { privateKey } = generateKeyPairSync('ed25519');
    const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const sig = signRpc(
      {
        did: 'did:revfleet:a:fp',
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
