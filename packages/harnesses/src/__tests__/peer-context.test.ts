import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { fetchPeerContext, formatPeerPanel } from '../session/peer-context.js';

describe('formatPeerPanel', () => {
  it('WARNs when unavailable (never silent empty)', () => {
    const text = formatPeerPanel({
      status: 'unavailable',
      reason: 'daemon socket absent',
      peers: [],
      reservations: [],
      findings: [],
      source: 'none',
    });
    expect(text).toContain('[peer-context] WARN');
    expect(text).toContain('daemon socket absent');
    expect(text).toContain('Proceeding without peer awareness');
  });

  it('lists peers and claims when available', () => {
    const text = formatPeerPanel({
      status: 'available',
      peers: [{ agentId: 'alice', task: 'GAP-459 S2', active: true }],
      reservations: [{ agentId: 'bob', path: '/tmp/x.ts' }],
      findings: [{ agentId: 'bob', eventType: 'peer.finding', summary: 'done' }],
      source: 'context.snapshot',
    });
    expect(text).toContain('[peer-context] ok');
    expect(text).toContain('alice');
    expect(text).toContain('GAP-459 S2');
    expect(text).toContain('/tmp/x.ts');
    expect(text).toContain('peer.finding');
  });

  it('shows none other when available with empty peers', () => {
    const text = formatPeerPanel({
      status: 'available',
      peers: [],
      reservations: [],
      findings: [],
      source: 'context.snapshot',
    });
    expect(text).toContain('peers: none other active');
    expect(text).not.toMatch(/WARN/);
  });

  it('notes abandoned sessions excluded from the live peer list', () => {
    const text = formatPeerPanel({
      status: 'available',
      peers: [{ agentId: 'live', task: 'working', active: true }],
      abandonedExcluded: 40,
      reservations: [],
      findings: [],
      source: 'context.snapshot',
    });
    expect(text).toContain('40 abandoned/idle');
    expect(text).toContain('archive workflow');
  });
});

describe('fetchPeerContext', () => {
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

  it('returns unavailable when socket missing', async () => {
    const snap = await fetchPeerContext({
      socketPath: join(tmpdir(), `no-sock-${Date.now()}`),
    });
    expect(snap.status).toBe('unavailable');
    expect(snap.source).toBe('none');
    expect(formatPeerPanel(snap)).toContain('WARN');
  });

  it('uses context.snapshot when the daemon implements it', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'peer-ctx-'));
    dirs.push(dir);
    const sock = join(dir, 'harness.sock');
    const server = createServer((socket) => {
      let buf = '';
      socket.on('data', (chunk) => {
        buf += chunk.toString();
        if (!buf.includes('\n')) return;
        const req = JSON.parse(buf.split('\n')[0]!) as { id: number; method: string };
        if (req.method === 'context.snapshot') {
          socket.write(
            `${JSON.stringify({
              jsonrpc: '2.0',
              id: req.id,
              result: {
                available: true,
                peers: [{ agentId: 'peer-1', task: 'hello', active: true, isSelf: false }],
                reservations: [],
                findings: [],
              },
            })}\n`,
          );
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

    const snap = await fetchPeerContext({ socketPath: sock, actorAgentId: 'me' });
    expect(snap.status).toBe('available');
    expect(snap.source).toBe('context.snapshot');
    expect(snap.peers).toHaveLength(1);
    expect(snap.peers[0]?.agentId).toBe('peer-1');
  });

  it('falls back to session.list when context.snapshot is missing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'peer-fallback-'));
    dirs.push(dir);
    const sock = join(dir, 'harness.sock');
    const server = createServer((socket) => {
      let buf = '';
      socket.on('data', (chunk) => {
        buf += chunk.toString();
        if (!buf.includes('\n')) return;
        const req = JSON.parse(buf.split('\n')[0]!) as { id: number; method: string };
        if (req.method === 'context.snapshot') {
          socket.write(
            `${JSON.stringify({
              jsonrpc: '2.0',
              id: req.id,
              error: { code: -32601, message: 'Method not found: context.snapshot' },
            })}\n`,
          );
        } else if (req.method === 'session.list') {
          socket.write(
            `${JSON.stringify({
              jsonrpc: '2.0',
              id: req.id,
              result: {
                sessions: [
                  { id: 'me', task: 'self', active: true, staleSeconds: 1 },
                  { id: 'other', task: 'peer work', active: true, staleSeconds: 2 },
                  { id: 'zombie', task: 'abandoned', active: false, staleSeconds: 99999 },
                ],
              },
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

    const snap = await fetchPeerContext({ socketPath: sock, actorAgentId: 'me' });
    expect(snap.status).toBe('degraded');
    expect(snap.source).toBe('session.list');
    expect(snap.peers.map((p) => p.agentId)).toEqual(['other']);
    expect(snap.abandonedExcluded).toBe(1);
    expect(formatPeerPanel(snap)).toContain('WARN');
    expect(formatPeerPanel(snap)).toContain('abandoned/idle');
  });
});
