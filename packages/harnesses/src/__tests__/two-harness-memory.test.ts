/**
 * Two-harness adapter acceptance: Claude + Grok materialize the same
 * stdio knowledge-graph server (not a second memory MCP), and a down
 * graph WARNs without throwing or blocking the other harness.
 */

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type {
  MemoryPrincipal,
  MemoryPublishInput,
  MemoryQuery,
} from '@revealui/knowledge-graph/memory';
import { afterEach, describe, expect, it } from 'vitest';
import { isSafeMcpServerName } from '../protocol/config-normalizer.js';
import {
  formatDurableMemoryWarn,
  publishDurableFinding,
  queryDurableMemory,
} from '../session/durable-memory.js';
import {
  materializeStudioLocalKgMcp,
  mergeGrokTomlKgMcp,
  STUDIO_LOCAL_KG_MCP_COMMAND,
  STUDIO_LOCAL_KG_MCP_SERVER_NAME,
  studioLocalKnowledgeGraphMcpServer,
} from '../session/studio-local-kg-mcp.js';

const claude: MemoryPrincipal = {
  did: 'did:revfleet:claude-1:fpcla',
  agentId: 'claude-1',
  fingerprint: 'fpcla',
  didKind: 'agent-key',
  harness: 'claude',
  tenantId: 'studio-local',
  trustBoundary: 'studio-local',
  isFleetOperator: true,
};

const grok: MemoryPrincipal = {
  ...claude,
  did: 'did:revfleet:grok-1:fpgro',
  agentId: 'grok-1',
  fingerprint: 'fpgro',
  harness: 'grok',
};

function publishInput(principal: MemoryPrincipal): MemoryPublishInput {
  return {
    principal,
    scope: { tenantId: 'studio-local', classification: 'workspace' },
    summary: 'brass-compass-finding',
    subjects: [
      {
        kind: 'concept',
        name: 'brass-compass-finding',
        naturalKey: 'concept:brass-compass-finding',
      },
    ],
    siteId: 'test-host',
  };
}

function queryInput(principal: MemoryPrincipal): MemoryQuery {
  return { principal, query: 'brass-compass-finding' };
}

describe('studio-local pair attaches to one knowledge-graph MCP', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
  });

  it('Claude and Grok emit the same revealui-mcp knowledge-graph entry', () => {
    const server = studioLocalKnowledgeGraphMcpServer();
    expect(isSafeMcpServerName(server.name)).toBe(true);
    expect(server.name).toBe(STUDIO_LOCAL_KG_MCP_SERVER_NAME);
    expect(server.command).toBe(STUDIO_LOCAL_KG_MCP_COMMAND);
    expect(server.args).toEqual(['knowledge-graph']);
  });

  it('materialize does not add a second knowledge-graph server', () => {
    const root = mkdtempSync(join(tmpdir(), 'kg-pair-'));
    dirs.push(root);
    materializeStudioLocalKgMcp(root);
    materializeStudioLocalKgMcp(root);

    const claudeSettings = JSON.parse(
      readFileSync(join(root, '.claude/settings.json'), 'utf-8'),
    ) as { mcpServers: Record<string, { command: string; args: string[] }> };
    const kgKeys = Object.keys(claudeSettings.mcpServers).filter(
      (name) => name === 'knowledge-graph',
    );
    expect(kgKeys).toEqual(['knowledge-graph']);
    expect(claudeSettings.mcpServers['knowledge-graph']).toEqual({
      command: 'revealui-mcp',
      args: ['knowledge-graph'],
    });

    const grokToml = readFileSync(join(root, '.grok/config.toml'), 'utf-8');
    const twice = mergeGrokTomlKgMcp(grokToml);
    expect(twice.split('[mcp_servers.knowledge-graph]').length - 1).toBe(1);
    expect(twice).toContain('command = "revealui-mcp"');
    expect(twice).toContain('args = ["knowledge-graph"]');
  });
});

describe('drop graph credentials on B', () => {
  it('WARNs and proceeds without throwing or printing no facts', async () => {
    const result = await queryDurableMemory(queryInput(grok), {
      timeoutMs: 0,
      callTool: async () => {
        throw new Error('ECONNREFUSED neon');
      },
    });
    expect(result.status).toBe('unavailable');
    const warn = formatDurableMemoryWarn(result);
    expect(warn).toContain('[durable-memory] WARN');
    expect(warn).toContain('Proceeding without durable memory');
    expect(warn).not.toContain('no facts');
  });

  it('does not block B on a hung A publish', async () => {
    const aPublish = publishDurableFinding(publishInput(claude), {
      timeoutMs: 50,
      callTool: () => new Promise(() => undefined),
    });
    const bQuery = queryDurableMemory(queryInput(grok), {
      timeoutMs: 0,
      callTool: async () => ({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'ok',
              available: true,
              enforcement: 'deferred',
              deniedCount: 0,
              data: { nodes: [], facts: [] },
            }),
          },
        ],
      }),
    });
    const b = await bQuery;
    expect(b.status).toBe('ok');
    const a = await aPublish;
    expect(a.status).toBe('unavailable');
    if (a.status === 'unavailable') expect(a.reason).toBe('timeout');
  });
});
