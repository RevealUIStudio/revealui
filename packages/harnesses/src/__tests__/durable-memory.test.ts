import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  MemoryPrincipal,
  MemoryPublishData,
  MemoryPublishInput,
  MemoryQuery,
  MemoryResult,
} from '@revealui/knowledge-graph/memory';
import type { KgSearchResult } from '@revealui/knowledge-graph/search';
import { afterEach, describe, expect, it } from 'vitest';
import { isSafeMcpServerName } from '../protocol/config-normalizer.js';
import {
  formatDurableMemoryWarn,
  publishDurableFinding,
  queryDurableMemory,
} from '../session/durable-memory.js';
import {
  CLAUDE_SETTINGS_REL,
  GROK_MCP_TOML_REL,
  materializeStudioLocalKgMcp,
  mergeClaudeSettingsKgMcp,
  mergeGrokTomlKgMcp,
  STUDIO_LOCAL_KG_MCP_COMMAND,
  STUDIO_LOCAL_KG_MCP_SERVER_NAME,
  studioLocalKnowledgeGraphMcpServer,
} from '../session/studio-local-kg-mcp.js';

const principal: MemoryPrincipal = {
  did: 'did:revfleet:grok-1:fpabc',
  agentId: 'grok-1',
  fingerprint: 'fpabc',
  didKind: 'agent-key',
  harness: 'grok',
  tenantId: 'studio-local',
  trustBoundary: 'studio-local',
  isFleetOperator: true,
};

function publishInput(): MemoryPublishInput {
  return {
    principal,
    scope: { tenantId: 'studio-local', classification: 'workspace', repo: 'revealui' },
    summary: 'found a durable fact',
    subjects: [{ kind: 'file', name: 'durable-memory.ts', naturalKey: 'revealui/x.ts' }],
    siteId: 'test-host',
  };
}

function queryInput(): MemoryQuery {
  return { principal, query: 'durable fact' };
}

describe('formatDurableMemoryWarn', () => {
  it('WARNs hosted unwired with the scope-enforcement-unwired reason', () => {
    const text = formatDurableMemoryWarn({
      status: 'unavailable',
      available: false,
      reason: 'scope-enforcement-unwired',
      message: 'hosted reads need scope SQL',
    });
    expect(text).toBe(
      '[durable-memory] WARN: knowledge graph unavailable (scope-enforcement-unwired). Proceeding without durable memory.\n',
    );
  });

  it('WARNs other unavailable reasons without swallowing the failure', () => {
    const text = formatDurableMemoryWarn({
      status: 'unavailable',
      available: false,
      reason: 'principal-missing',
      message: 'no identity',
    });
    expect(text).toContain('[durable-memory] WARN');
    expect(text).toContain('principal-missing');
    expect(text).toContain('Proceeding without durable memory');
    expect(text).not.toContain('no facts');
  });

  it('formats deny with classification and tenant', () => {
    const text = formatDurableMemoryWarn({
      status: 'denied',
      available: true,
      reason: 'scope-denied',
      scope: { tenantId: 't_123', classification: 'workspace' },
      message: 'out of scope',
      deniedCount: 2,
    });
    expect(text).toBe(
      '[durable-memory] deny: scope-denied (workspace t_123). Proceeding without that read.\n',
    );
  });

  it('notes studio-local deferred; stays silent when enforced', () => {
    const deferred = formatDurableMemoryWarn({
      status: 'ok',
      available: true,
      enforcement: 'deferred',
      deniedCount: 0,
      data: {},
    });
    expect(deferred).toBe(
      '[durable-memory] note: studio-local, unscoped by design (single-operator).\n',
    );
    const enforced = formatDurableMemoryWarn({
      status: 'ok',
      available: true,
      enforcement: 'enforced',
      deniedCount: 0,
      data: {},
    });
    expect(enforced).toBe('');
  });
});

describe('publishDurableFinding / queryDurableMemory', () => {
  it('returns unwired when neither executor nor callTool is provided', async () => {
    const published = await publishDurableFinding(publishInput());
    expect(published.status).toBe('unavailable');
    if (published.status === 'unavailable') {
      expect(published.reason).toBe('durable-memory-unwired');
    }
    const queried = await queryDurableMemory(queryInput());
    expect(queried.status).toBe('unavailable');
  });

  it('never throws when the executor rejects', async () => {
    const result = await publishDurableFinding(publishInput(), {
      timeoutMs: 0,
      executor: {
        publishMemory: async () => {
          throw new Error('boom');
        },
      },
    });
    expect(result.status).toBe('unavailable');
    if (result.status === 'unavailable') {
      expect(result.message).toContain('boom');
    }
  });

  it('uses an injected in-process executor', async () => {
    const published: MemoryResult<MemoryPublishData> = {
      status: 'ok',
      available: true,
      enforcement: 'deferred',
      deniedCount: 0,
      data: { episodeId: 'ep-1', nodeCount: 2, edgeCount: 1 },
    };
    const result = await publishDurableFinding(publishInput(), {
      timeoutMs: 0,
      executor: { publishMemory: async () => published },
    });
    expect(result).toEqual(published);
  });

  it('maps publish to kg_add_episode and parses the product envelope', async () => {
    let name = '';
    let args: Record<string, unknown> = {};
    const result = await publishDurableFinding(publishInput(), {
      timeoutMs: 0,
      callTool: async (toolName, toolArgs) => {
        name = toolName;
        args = toolArgs;
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                status: 'ok',
                available: true,
                enforcement: 'deferred',
                deniedCount: 0,
                data: { episodeId: 'ep-mcp', nodeCount: 2, edgeCount: 0 },
              }),
            },
          ],
        };
      },
    });
    expect(name).toBe('kg_add_episode');
    expect(args.episodeType).toBe('agent-fact');
    expect(args.content).toBe('found a durable fact');
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.episodeId).toBe('ep-mcp');
      expect(result.enforcement).toBe('deferred');
    }
  });

  it('does not treat MCP isError as empty ok', async () => {
    const result = await queryDurableMemory(queryInput(), {
      timeoutMs: 0,
      callTool: async () => ({
        isError: true,
        content: [{ type: 'text', text: 'Error: neon down' }],
      }),
    });
    expect(result.status).toBe('unavailable');
    if (result.status === 'unavailable') {
      expect(result.message).toContain('neon down');
    }
    expect(formatDurableMemoryWarn(result)).not.toContain('no facts');
  });

  it('parses a denied envelope from kg_search', async () => {
    const result = await queryDurableMemory(queryInput(), {
      timeoutMs: 0,
      callTool: async () => ({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'denied',
              available: true,
              reason: 'scope-denied',
              scope: { tenantId: 't_123', classification: 'workspace' },
              message: 'out of scope',
              deniedCount: 3,
            }),
          },
        ],
      }),
    });
    expect(result.status).toBe('denied');
    if (result.status === 'denied') {
      expect(result.scope.tenantId).toBe('t_123');
      expect(result.deniedCount).toBe(3);
    }
  });

  it('races a hanging caller against timeoutMs', async () => {
    const result = await queryDurableMemory(queryInput(), {
      timeoutMs: 50,
      callTool: () => new Promise(() => undefined),
    });
    expect(result.status).toBe('unavailable');
    if (result.status === 'unavailable') {
      expect(result.reason).toBe('timeout');
    }
  });

  it('timeoutMs 0 waits for the executor instead of racing', async () => {
    const empty: KgSearchResult = { nodes: [], facts: [] };
    const result = await queryDurableMemory(queryInput(), {
      timeoutMs: 0,
      executor: {
        queryMemory: async () => ({
          status: 'ok',
          available: true,
          enforcement: 'enforced',
          deniedCount: 0,
          data: empty,
        }),
      },
    });
    expect(result.status).toBe('ok');
  });
});

describe('studio-local knowledge-graph MCP materialize', () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const d of dirs) {
      rmSync(d, { recursive: true, force: true });
    }
    dirs.length = 0;
  });

  it('uses a safe MCP server name and revealui-mcp knowledge-graph', () => {
    const server = studioLocalKnowledgeGraphMcpServer();
    expect(isSafeMcpServerName(server.name)).toBe(true);
    expect(server.name).toBe(STUDIO_LOCAL_KG_MCP_SERVER_NAME);
    expect(server.command).toBe(STUDIO_LOCAL_KG_MCP_COMMAND);
    expect(server.args).toEqual(['knowledge-graph']);
    expect(server.env).toBeUndefined();
  });

  it('merges Claude settings without dropping existing servers', () => {
    const next = mergeClaudeSettingsKgMcp(
      JSON.stringify({ mcpServers: { github: { command: 'npx' } }, env: { A: '1' } }),
    );
    expect(next).not.toBeNull();
    const parsed = JSON.parse(next ?? '{}') as {
      mcpServers: Record<string, { command: string; args?: string[] }>;
      env: { A: string };
    };
    expect(parsed.env.A).toBe('1');
    expect(parsed.mcpServers.github.command).toBe('npx');
    expect(parsed.mcpServers['knowledge-graph']).toEqual({
      command: 'revealui-mcp',
      args: ['knowledge-graph'],
    });
  });

  it('does not clobber invalid Claude settings JSON', () => {
    expect(mergeClaudeSettingsKgMcp('not-json{')).toBeNull();
  });

  it('preserves an existing Grok hosted revealui table', () => {
    const existing = `# Project-scoped Grok MCP attach
[mcp_servers.revealui]
url = "https://api.revealui.com/api/mcp"
enabled = true

[mcp_servers.revealui.headers]
Authorization = "Bearer \${REVEALUI_MCP_TOKEN}"
`;
    const next = mergeGrokTomlKgMcp(existing);
    expect(next).toContain('[mcp_servers.revealui]');
    expect(next).toContain('api.revealui.com');
    expect(next).toContain('[mcp_servers.knowledge-graph]');
    expect(next).toContain('command = "revealui-mcp"');
    expect(next).toContain('args = ["knowledge-graph"]');
    expect(next).toContain('# BEGIN GENERATED:studio-local-kg-mcp');
  });

  it('is idempotent on Grok toml (no duplicate tables)', () => {
    const once = mergeGrokTomlKgMcp(null);
    const twice = mergeGrokTomlKgMcp(once);
    const count = twice.split('[mcp_servers.knowledge-graph]').length - 1;
    expect(count).toBe(1);
  });

  it('writes Claude + Grok project files and never Cursor/OpenCode or HOME', () => {
    const root = mkdtempSync(join(tmpdir(), 'kg-mcp-mat-'));
    dirs.push(root);
    const written = materializeStudioLocalKgMcp(root);
    expect(written.claudeSettings).toBe(CLAUDE_SETTINGS_REL);
    expect(written.grokToml).toBe(GROK_MCP_TOML_REL);

    const claude = JSON.parse(readFileSync(join(root, CLAUDE_SETTINGS_REL), 'utf-8')) as {
      mcpServers: Record<string, { command: string; args: string[] }>;
    };
    expect(claude.mcpServers['knowledge-graph'].command).toBe('revealui-mcp');
    expect(claude.mcpServers['knowledge-graph'].args).toEqual(['knowledge-graph']);

    const grok = readFileSync(join(root, GROK_MCP_TOML_REL), 'utf-8');
    expect(grok).toContain('[mcp_servers.knowledge-graph]');

    let cursorWritten = false;
    try {
      readFileSync(join(root, '.cursor', 'mcp.json'), 'utf-8');
      cursorWritten = true;
    } catch (err) {
      expect(err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT').toBe(true);
    }
    expect(cursorWritten).toBe(false);

    let opencodeWritten = false;
    try {
      readFileSync(join(root, 'opencode.json'), 'utf-8');
      opencodeWritten = true;
    } catch (err) {
      expect(err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT').toBe(true);
    }
    expect(opencodeWritten).toBe(false);

    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../session/studio-local-kg-mcp.ts'),
      'utf-8',
    );
    expect(src).not.toContain("homedir(), '.grok'");
    expect(src).not.toContain('~/.grok');
  });
});

describe('session CLI does not auto-query durable memory', () => {
  it('register path does not call queryClaims or the durable helper', () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../session/cli.ts'),
      'utf-8',
    );
    expect(src).not.toContain('queryClaims');
    expect(src).not.toContain('queryDurableMemory');
    expect(src).not.toContain('publishDurableFinding');
  });
});
