import { generateKeyPairSync, verify } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fingerprintAgentKey } from '@revealui/knowledge-graph/memory';
import { expect, it, vi } from 'vitest';
import { CodexAdapter } from '../adapters/codex-adapter.js';
import { hashParams } from '../session/index.js';
import * as launcher from '../session/studio-local-kg-mcp.js';

const available = process.env.PATH?.split(delimiter).some((dir) => existsSync(join(dir, 'codex')));

/** Native MCP calls use no model turn, login credentials, or external database. */
it.skipIf(!available)(
  'native Codex publishes, scopes, fails closed, and releases signed identities',
  async () => {
    const root = mkdtempSync(join(tmpdir(), 'codex-memory-live-'));
    const socketPath = join(root, 'daemon.sock');
    const identityDir = join(root, 'identities');
    const sessionDir = join(root, 'sessions');
    const archiveDir = join(root, 'archive');
    const trace = join(root, 'requests.jsonl');
    const unavailable = join(root, 'storage-unavailable');
    const keys = generateKeyPairSync('ed25519');
    const fingerprint = fingerprintAgentKey(
      keys.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    );
    const issued: string[] = [];
    const ended: string[] = [];
    const daemon = createServer((socket) => {
      socket.once('data', (chunk) => {
        const request = JSON.parse(chunk.toString());
        let result = {};
        if (request.method === 'session.register') {
          const agentId = request.params.agentId;
          issued.push(agentId);
          result = {
            agentId,
            did: `did:revealfleet:${agentId}:${fingerprint}`,
            privateKeyPem: keys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
          };
        } else {
          const [header, payload, signature] = request['x-revdev-signature'].split('.');
          expect(
            verify(
              null,
              Buffer.from(`${header}.${payload}`),
              keys.publicKey,
              Buffer.from(signature, 'base64url'),
            ),
          ).toBe(true);
          expect(JSON.parse(Buffer.from(payload, 'base64url').toString()).paramsHash).toBe(
            hashParams('session.end', request.params),
          );
          ended.push(request.params.actorAgentId);
        }
        socket.end(`${JSON.stringify({ id: request.id, result })}\n`);
      });
    });
    const adapters: CodexAdapter[] = [];
    try {
      await new Promise<void>((resolve) => daemon.listen(socketPath, resolve));
      const cli = createRequire(import.meta.url).resolve('@revealui/mcp/cli');
      const requireMcp = createRequire(cli);
      const url = (path: string) => JSON.stringify(pathToFileURL(path).href);
      const server = join(root, 'mcp.mjs');
      // Only the synthetic storage driver is substituted; provider, schema,
      // publication, SQL authorization, envelopes and stdio transport are real.
      writeFileSync(
        server,
        `
import { existsSync } from 'node:fs';
import { PGlite } from ${url(requireMcp.resolve('@electric-sql/pglite'))};
import { StdioServerTransport } from ${url(requireMcp.resolve('@modelcontextprotocol/sdk/server/stdio.js'))};
import { kgDdlStatements, makeExecutor } from ${url(requireMcp.resolve('@revealui/knowledge-graph'))};
import { createKnowledgeGraphServer } from ${url(join(dirname(cli), 'servers/factories/knowledge-graph.js'))};
import { loadStudioPrincipal } from ${url(join(dirname(cli), 'servers/_kg-principal.js'))};
const db = new PGlite(${JSON.stringify(join(root, 'db'))});
for (const sql of kgDdlStatements({ variant: 'portable' })) await db.exec(sql);
const executor = makeExecutor(db);
const checked = { transaction: (...args) => executor.transaction(...args), query: (...args) => {
  if (existsSync(${JSON.stringify(unavailable)})) throw new Error('synthetic storage unavailable');
  return executor.query(...args);
}};
await createKnowledgeGraphServer({ executor: checked, mode: 'product', trustBoundary: 'studio-local', timeoutMs: 0,
  principalProvider: loadStudioPrincipal, embedder: async () => { throw new Error('synthetic embeddings disabled'); }
}).connect(new StdioServerTransport());
`,
      );
      const canonical = launcher.studioLocalKnowledgeGraphMcpServer;
      const launch = vi
        .spyOn(launcher, 'studioLocalKnowledgeGraphMcpServer')
        .mockImplementation((runtime) => {
          const config = canonical(runtime);
          expect(config.command).toBe(process.execPath);
          expect(config.args).toEqual([cli, 'knowledge-graph']);
          expect(config.env).not.toHaveProperty('privateKeyPem');
          return { ...config, args: [server] };
        });
      mkdirSync(join(root, 'codex-home'));
      const binary = join(root, 'codex.cjs');
      writeFileSync(
        binary,
        `#!/usr/bin/env node
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const readline = require('node:readline');
const child = spawn('codex', process.argv.slice(2), { env: { ...process.env, CODEX_HOME: ${JSON.stringify(join(root, 'codex-home'))} }, stdio: ['pipe', 'inherit', 'pipe'] });
child.stderr.on('data', data => fs.appendFileSync(${JSON.stringify(join(root, 'stderr.log'))}, data));
readline.createInterface({ input: process.stdin }).on('line', line => {
  fs.appendFileSync(${JSON.stringify(trace)}, line + '\\n'); child.stdin.write(line + '\\n');
}).on('close', () => child.stdin.end());
child.on('exit', code => process.exit(code ?? 1));
`,
      );
      chmodSync(binary, 0o755);
      const config = {
        projectRoot: root,
        binaryPath: binary,
        timeoutMs: 30000,
        studioLocalMemory: { socketPath, identityDir, sessionDir, archiveDir },
      };
      const writer = new CodexAdapter(config);
      const reader = new CodexAdapter(config);
      adapters.push(writer, reader);
      const publish = (classification: 'workspace' | 'private', token: string) =>
        writer.execute({
          type: 'publish-memory',
          input: {
            scope: { tenantId: 'studio-local', classification },
            siteId: 'native-codex-fixture',
            summary: token,
            subjects: [{ kind: 'concept', name: token, naturalKey: `concept:${token}` }],
          },
        });
      const published = await publish('workspace', 'brasscompass');
      expect(
        published.success,
        JSON.stringify(published) +
          '\n' +
          readFileSync(trace, 'utf8') +
          '\n' +
          (existsSync(join(root, 'stderr.log'))
            ? readFileSync(join(root, 'stderr.log'), 'utf8')
            : ''),
      ).toBe(true);
      expect(published).toMatchObject({
        success: true,
        data: { status: 'ok', enforcement: 'enforced' },
      });
      const shared = await reader.execute({
        type: 'query-memory',
        input: { query: 'brasscompass' },
      });
      expect(
        shared.success,
        `${JSON.stringify(shared)}\n${readFileSync(join(root, 'stderr.log'), 'utf8')}`,
      ).toBe(true);
      expect(shared).toMatchObject({
        success: true,
        data: {
          status: 'ok',
          enforcement: 'enforced',
          data: {
            nodes: expect.arrayContaining([expect.objectContaining({ name: 'brasscompass' })]),
          },
        },
      });
      expect(await publish('private', 'saffronsecret')).toMatchObject({ success: true });
      expect(
        await writer.execute({ type: 'query-memory', input: { query: 'saffronsecret' } }),
      ).toMatchObject({ success: true });
      expect(
        await reader.execute({ type: 'query-memory', input: { query: 'saffronsecret' } }),
      ).toMatchObject({ success: false, data: { status: 'denied', reason: 'scope-denied' } });
      expect(
        await writer.execute({
          type: 'publish-memory',
          input: {
            scope: { tenantId: 'foreign', classification: 'workspace' },
            siteId: 'test',
            summary: 'forbidden',
            subjects: [],
          },
        }),
      ).toMatchObject({ success: false, data: { status: 'denied' } });
      writeFileSync(unavailable, 'synthetic failure');
      expect(
        await reader.execute({ type: 'query-memory', input: { query: 'brasscompass' } }),
      ).toMatchObject({
        success: false,
        data: { status: 'unavailable', reason: 'kg-database-unavailable' },
      });
      const missing = new CodexAdapter({
        ...config,
        studioLocalMemory: { ...config.studioLocalMemory, socketPath: join(root, 'absent.sock') },
      });
      adapters.push(missing);
      const callsBefore = launch.mock.calls.length;
      expect(
        await missing.execute({ type: 'query-memory', input: { query: 'brasscompass' } }),
      ).toMatchObject({
        success: false,
        data: { status: 'unavailable', reason: 'principal-missing' },
      });
      expect(launch).toHaveBeenCalledTimes(callsBefore);
      const requests = readFileSync(trace, 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line));
      expect(requests.some((request) => request.method === 'mcpServer/tool/call')).toBe(true);
      expect(requests.some((request) => request.method === 'turn/start')).toBe(false);
      await Promise.all(adapters.map((adapter) => adapter.dispose()));
      expect(ended.sort()).toEqual(issued.sort());
      expect(readdirSync(identityDir)).toEqual([]);
      expect(readdirSync(sessionDir)).toEqual([]);
      expect(existsSync(archiveDir)).toBe(true);
    } finally {
      await Promise.all(adapters.map((adapter) => adapter.dispose()));
      vi.restoreAllMocks();
      await new Promise<void>((resolve) => daemon.close(() => resolve()));
      rmSync(root, { recursive: true, force: true });
    }
  },
  120000,
);
