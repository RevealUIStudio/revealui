/**
 * Studio-local knowledge-graph MCP attach for Claude Code + Grok stdio.
 *
 * Both harnesses spawn `revealui-mcp knowledge-graph` (product mode,
 * trustBoundary studio-local). Cursor/OpenCode stay on the hosted HTTP
 * composite and are not written here. Never writes `$HOME/.grok`.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { McpServerConfig } from '../protocol/adapter.js';

export const STUDIO_LOCAL_KG_MCP_SERVER_NAME = 'knowledge-graph';
export const STUDIO_LOCAL_KG_MCP_COMMAND = 'revealui-mcp';
export const STUDIO_LOCAL_KG_MCP_ARGS: readonly string[] = ['knowledge-graph'];

export const CLAUDE_SETTINGS_REL = join('.claude', 'settings.json');
export const GROK_MCP_TOML_REL = join('.grok', 'config.toml');

const GENERATED_BEGIN = '# BEGIN GENERATED:studio-local-kg-mcp';
const GENERATED_END = '# END GENERATED:studio-local-kg-mcp';

export function studioLocalKnowledgeGraphMcpServer(): McpServerConfig {
  return {
    name: STUDIO_LOCAL_KG_MCP_SERVER_NAME,
    command: STUDIO_LOCAL_KG_MCP_COMMAND,
    args: [...STUDIO_LOCAL_KG_MCP_ARGS],
  };
}

export function studioLocalKgGrokTomlBlock(): string {
  return [
    GENERATED_BEGIN,
    `[mcp_servers.${STUDIO_LOCAL_KG_MCP_SERVER_NAME}]`,
    `command = "${STUDIO_LOCAL_KG_MCP_COMMAND}"`,
    `args = ${JSON.stringify([...STUDIO_LOCAL_KG_MCP_ARGS])}`,
    'enabled = true',
    GENERATED_END,
  ].join('\n');
}

function isEnoent(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === 'ENOENT'
  );
}

function readFileOrNull(filePath: string): string | null {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch (err) {
    if (isEnoent(err)) return null;
    throw err;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function claudeSettingsHasStudioLocalKg(text: string): boolean {
  try {
    const parsed = asRecord(JSON.parse(text) as unknown);
    const servers = asRecord(parsed?.mcpServers);
    const entry = asRecord(servers?.[STUDIO_LOCAL_KG_MCP_SERVER_NAME]);
    if (!entry) return false;
    return entry.command === STUDIO_LOCAL_KG_MCP_COMMAND;
  } catch {
    return false;
  }
}

export function grokTomlHasStudioLocalKg(text: string): boolean {
  return text.includes(`[mcp_servers.${STUDIO_LOCAL_KG_MCP_SERVER_NAME}]`);
}

export function mergeClaudeSettingsKgMcp(existing: string | null): string | null {
  if (existing === null) {
    return `${JSON.stringify(
      {
        mcpServers: {
          [STUDIO_LOCAL_KG_MCP_SERVER_NAME]: {
            command: STUDIO_LOCAL_KG_MCP_COMMAND,
            args: [...STUDIO_LOCAL_KG_MCP_ARGS],
          },
        },
      },
      null,
      2,
    )}\n`;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(existing) as unknown;
  } catch {
    return null;
  }
  const obj = asRecord(parsed);
  if (!obj) return null;

  const servers = asRecord(obj.mcpServers) ?? {};
  servers[STUDIO_LOCAL_KG_MCP_SERVER_NAME] = {
    command: STUDIO_LOCAL_KG_MCP_COMMAND,
    args: [...STUDIO_LOCAL_KG_MCP_ARGS],
  };
  obj.mcpServers = servers;
  return `${JSON.stringify(obj, null, 2)}\n`;
}

function dropTomlTable(source: string, tableName: string): string {
  const header = `[${tableName}]`;
  const nestedPrefix = `[${tableName}.`;
  const lines = source.split('\n');
  const out: string[] = [];
  let skipping = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === header || trimmed.startsWith(nestedPrefix)) {
      skipping = true;
      continue;
    }
    if (skipping) {
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        skipping = false;
        out.push(line);
      }
      continue;
    }
    out.push(line);
  }
  return out.join('\n');
}

export function mergeGrokTomlKgMcp(existing: string | null): string {
  const block = studioLocalKgGrokTomlBlock();
  if (existing === null || existing.trim() === '') {
    return `${block}\n`;
  }

  const start = existing.indexOf(GENERATED_BEGIN);
  const stop = existing.indexOf(GENERATED_END);
  if (start >= 0 && stop > start) {
    let endIdx = stop + GENERATED_END.length;
    if (existing[endIdx] === '\r') endIdx += 1;
    if (existing[endIdx] === '\n') endIdx += 1;
    return `${existing.slice(0, start)}${block}\n${existing.slice(endIdx)}`;
  }

  const withoutTable = dropTomlTable(
    existing,
    `mcp_servers.${STUDIO_LOCAL_KG_MCP_SERVER_NAME}`,
  ).replace(/\s+$/, '');
  if (withoutTable.length === 0) return `${block}\n`;
  return `${withoutTable}\n\n${block}\n`;
}

export interface MaterializeStudioLocalKgMcpResult {
  readonly claudeSettings?: string;
  readonly grokToml?: string;
}

export interface MaterializeStudioLocalKgMcpOptions {
  readonly claude?: boolean;
  readonly grok?: boolean;
}

/**
 * Merge the studio-local knowledge-graph stdio server into Claude settings
 * and Grok project config. Idempotent. Does not touch Cursor/OpenCode.
 */
export function materializeStudioLocalKgMcp(
  projectRoot: string,
  options: MaterializeStudioLocalKgMcpOptions = {},
): MaterializeStudioLocalKgMcpResult {
  const writeClaude = options.claude !== false;
  const writeGrok = options.grok !== false;
  const result: { claudeSettings?: string; grokToml?: string } = {};

  if (writeClaude) {
    const rel = CLAUDE_SETTINGS_REL;
    const abs = join(projectRoot, rel);
    const next = mergeClaudeSettingsKgMcp(readFileOrNull(abs));
    if (next !== null) {
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, next, 'utf-8');
      result.claudeSettings = rel;
    }
  }

  if (writeGrok) {
    const rel = GROK_MCP_TOML_REL;
    const abs = join(projectRoot, rel);
    const next = mergeGrokTomlKgMcp(readFileOrNull(abs));
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, next, 'utf-8');
    result.grokToml = rel;
  }

  return result;
}
