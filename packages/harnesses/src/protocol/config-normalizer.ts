/**
 * Config Normalization
 *
 * Bidirectional: ProtocolConfig <-> Claude Code settings.json
 * Write-only: ProtocolConfig -> .cursorrules markdown
 * Write-only: ProtocolConfig -> AGENTS.md markdown
 */

import type { ProtocolConfig, ProtocolRule } from './adapter.js';
import { PROTOCOL_VERSION } from './event-envelope.js';

/** Result of config generation: map of relative file paths to contents. */
export interface ConfigGenerationResult {
  files: Map<string, string>;
}

// -- Key-safety barrier ---------------------------------------------------------

/**
 * MCP server names are used as object keys in the emitted Claude Code
 * settings.json. To prevent prototype-pollution vectors and satisfy the
 * CodeQL `js/remote-property-injection` sink, names must:
 *   1. match a strict allowlist pattern (leading alphanumeric + up to 63 more
 *      ASCII letters/digits/underscores/hyphens), and
 *   2. not collide with any `Object.prototype` member name (`constructor`,
 *      `prototype`, `toString`, …).
 * The regex alone rejects `__proto__` and non-identifier characters; the
 * denylist closes the gap on plain-word property collisions like
 * `constructor`.
 */
// REGEX-CONFIG-BOUNDARY: MCP server name validator, CodeQL js/remote-property-injection sink.
const MCP_SERVER_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;

const FORBIDDEN_MCP_SERVER_NAMES: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toLocaleString',
  'toString',
  'valueOf',
]);

export function isSafeMcpServerName(name: unknown): name is string {
  return (
    typeof name === 'string' &&
    MCP_SERVER_NAME_PATTERN.test(name) &&
    !FORBIDDEN_MCP_SERVER_NAMES.has(name)
  );
}

// -- Claude Code settings.json <-> ProtocolConfig -------------------------------

/** Subset of Claude Code settings.json we read/write. */
export interface ClaudeCodeSettings {
  permissions?: {
    allow?: string[];
    deny?: string[];
  };
  env?: Record<string, string>;
  mcpServers?: Record<string, { command: string; args?: string[]; env?: Record<string, string> }>;
}

/** Convert a ProtocolConfig to Claude Code settings.json format. */
export function protocolConfigToClaudeSettings(config: ProtocolConfig): ClaudeCodeSettings {
  const settings: ClaudeCodeSettings = {};

  if (config.permissions.autoApprove.length > 0 || config.permissions.deny.length > 0) {
    settings.permissions = {};
    if (config.permissions.autoApprove.length > 0) {
      settings.permissions.allow = config.permissions.autoApprove;
    }
    if (config.permissions.deny.length > 0) {
      settings.permissions.deny = config.permissions.deny;
    }
  }

  if (Object.keys(config.environment.variables).length > 0) {
    settings.env = { ...config.environment.variables };
  }

  if (config.environment.mcpServers.length > 0) {
    const servers: NonNullable<ClaudeCodeSettings['mcpServers']> = {};
    for (const server of config.environment.mcpServers) {
      // Allowlist-validated name; regex barrier excludes __proto__, constructor, etc.
      if (!isSafeMcpServerName(server.name)) continue;
      servers[server.name] = {
        command: server.command,
        ...(server.args && { args: server.args }),
        ...(server.env && { env: server.env }),
      };
    }
    if (Object.keys(servers).length > 0) {
      settings.mcpServers = servers;
    }
  }

  return settings;
}

/** Parse Claude Code settings.json into a partial ProtocolConfig. */
export function claudeSettingsToProtocolConfig(
  settings: ClaudeCodeSettings,
): Partial<ProtocolConfig> {
  const config: Partial<ProtocolConfig> = {};

  if (settings.permissions) {
    config.permissions = {
      autoApprove: settings.permissions.allow ?? [],
      deny: settings.permissions.deny ?? [],
    };
  }

  // External settings.json is untrusted input — drop entries whose keys don't
  // match our allowlist so malicious names can't round-trip through the adapter.
  const mcpServers = settings.mcpServers
    ? Object.entries(settings.mcpServers)
        .filter(([name]) => isSafeMcpServerName(name))
        .map(([name, server]) => ({
          name,
          command: server.command,
          ...(server.args && { args: server.args }),
          ...(server.env && { env: server.env }),
        }))
    : [];

  config.environment = {
    variables: settings.env ?? {},
    mcpServers,
  };

  return config;
}

// -- .cursorrules (write-only) ---------------------------------------------------

/** Generate .cursorrules markdown from ProtocolConfig. */
export function protocolConfigToCursorrules(config: ProtocolConfig): string {
  const lines: string[] = [];

  lines.push('# Project Rules');
  lines.push('');
  lines.push('## Identity');
  lines.push(`- Name: ${config.identity.name}`);
  if (config.identity.role) {
    lines.push(`- Role: ${config.identity.role}`);
  }
  lines.push('');

  if (config.rules.length > 0) {
    lines.push('## Rules');
    lines.push('');
    for (const rule of config.rules) {
      lines.push(`### ${rule.id}`);
      lines.push('');
      lines.push(rule.description);
      lines.push('');
      lines.push(renderRuleContent(rule));
      lines.push('');
    }
  }

  if (config.skills.length > 0) {
    lines.push('## Skills');
    lines.push('');
    for (const skill of config.skills) {
      lines.push(`### ${skill.name}`);
      lines.push('');
      lines.push(skill.description);
      lines.push('');
      lines.push(skill.instructions);
      lines.push('');
    }
  }

  return lines.join('\n');
}

// -- AGENTS.md (write-only) ------------------------------------------------------

/** Generate AGENTS.md markdown from ProtocolConfig. */
export function protocolConfigToAgentsMd(config: ProtocolConfig): string {
  const lines: string[] = [];

  lines.push('# AGENTS.md');
  lines.push('');
  lines.push(`> Generated by Harness Protocol v${PROTOCOL_VERSION}`);
  lines.push('');

  lines.push('## Identity');
  lines.push('');
  lines.push(`- Name: ${config.identity.name}`);
  lines.push(`- Email: ${config.identity.email}`);
  if (config.identity.role) {
    lines.push(`- Role: ${config.identity.role}`);
  }
  lines.push('');

  if (config.permissions.deny.length > 0) {
    lines.push('## Denied Operations');
    lines.push('');
    for (const d of config.permissions.deny) {
      lines.push(`- ${d}`);
    }
    lines.push('');
  }

  if (config.rules.length > 0) {
    lines.push('## Rules');
    lines.push('');
    for (const rule of config.rules) {
      lines.push(`### ${rule.id}`);
      lines.push('');
      lines.push(rule.description);
      lines.push('');
      if (rule.appliesTo.length > 0) {
        lines.push(`Applies to: ${rule.appliesTo.join(', ')}`);
        lines.push('');
      }
      lines.push(renderRuleContent(rule));
      lines.push('');
    }
  }

  if (config.commands.length > 0) {
    lines.push('## Commands');
    lines.push('');
    for (const cmd of config.commands) {
      lines.push(`### /${cmd.id}`);
      lines.push('');
      lines.push(cmd.description);
      lines.push('');
      if (cmd.steps.length > 0) {
        lines.push('Steps:');
        for (let i = 0; i < cmd.steps.length; i++) {
          lines.push(`${i + 1}. ${cmd.steps[i]}`);
        }
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

// -- Full generation -------------------------------------------------------------

/**
 * Generate all config files from a ProtocolConfig.
 * Returns a map of relative file paths to contents.
 */
export function generateAllConfigs(config: ProtocolConfig): ConfigGenerationResult {
  const files = new Map<string, string>();

  // Claude Code settings.json
  files.set(
    '.claude/settings.json',
    JSON.stringify(protocolConfigToClaudeSettings(config), null, 2),
  );

  // .cursorrules
  files.set('.cursorrules', protocolConfigToCursorrules(config));

  // AGENTS.md
  files.set('AGENTS.md', protocolConfigToAgentsMd(config));

  // Claude Code rules (one file per rule)
  for (const rule of config.rules) {
    const frontmatter = [
      '---',
      `description: ${rule.description}`,
      ...(rule.appliesTo.length > 0 ? [`globs: ${rule.appliesTo.join(', ')}`] : []),
      '---',
    ].join('\n');
    files.set(`.claude/rules/${rule.id}.md`, `${frontmatter}\n\n${renderRuleContent(rule)}\n`);
  }

  return { files };
}

// -- opencode.json (write-only) --------------------------------------------------

/** OpenCode remote MCP server entry (opencode.json `mcp.<name>`, design doc §5.7). */
export interface OpenCodeMcpServerConfig {
  type: 'remote';
  url: string;
  headers: Record<string, string>;
  oauth: boolean;
  enabled: boolean;
}

/** Subset of opencode.json this module writes. */
export interface OpenCodeConfig {
  mcp?: Record<string, OpenCodeMcpServerConfig>;
  tools?: Record<string, boolean>;
  permission?: Record<string, 'allow' | 'ask' | 'deny'>;
}

/** Options for wiring the RevealUI governed MCP endpoint into an OpenCode config. */
export interface OpenCodeMcpOptions {
  /** RevealUI governed MCP endpoint, e.g. `https://your-host/api/mcp`. */
  mcpUrl: string;
  /**
   * Name of the environment variable OpenCode resolves via its `{env:VAR}`
   * substitution at runtime (default `REVEALUI_MCP_TOKEN`). Only the
   * variable NAME is ever emitted -- see `protocolConfigToOpencodeConfig`.
   */
  tokenEnvVar?: string;
}

const DEFAULT_OPENCODE_TOKEN_ENV_VAR = 'REVEALUI_MCP_TOKEN';

/**
 * Convert a ProtocolConfig to an opencode.json fragment wiring the RevealUI
 * governed MCP endpoint (design doc §5.7).
 *
 * SECURITY-CRITICAL: this function must never emit a literal bearer token,
 * only the `{env:VAR}` substitution syntax OpenCode resolves at runtime. It
 * deliberately does NOT read `config.environment.variables` for a token
 * value -- the Authorization header is built exclusively from the
 * `tokenEnvVar` NAME, so no caller can smuggle a literal secret into the
 * emitted config by placing one in `environment.variables`.
 */
export function protocolConfigToOpencodeConfig(
  config: ProtocolConfig,
  opts: OpenCodeMcpOptions,
): OpenCodeConfig {
  const tokenEnvVar = opts.tokenEnvVar ?? DEFAULT_OPENCODE_TOKEN_ENV_VAR;

  const opencodeConfig: OpenCodeConfig = {
    mcp: {
      revealui: {
        type: 'remote',
        url: opts.mcpUrl,
        headers: { Authorization: `Bearer {env:${tokenEnvVar}}` },
        oauth: false,
        enabled: true,
      },
    },
    tools: { 'revealui*': true },
  };

  // Reuses the same key-safety barrier as the Claude Code settings.json
  // writer above -- permission keys become object keys in the emitted JSON,
  // so the same prototype-pollution allowlist applies.
  const permission: Record<string, 'allow' | 'ask' | 'deny'> = {};
  for (const name of config.permissions.autoApprove) {
    if (isSafeMcpServerName(name)) permission[name] = 'allow';
  }
  for (const name of config.permissions.deny) {
    if (isSafeMcpServerName(name)) permission[name] = 'deny';
  }
  if (Object.keys(permission).length > 0) {
    opencodeConfig.permission = permission;
  }

  return opencodeConfig;
}

// -- .cursor/mcp.json (write-only) ------------------------------------------------

/** Cursor remote/HTTP MCP server entry (`.cursor/mcp.json`). */
export interface CursorMcpServerConfig {
  url: string;
  headers: Record<string, string>;
}

/** Subset of `.cursor/mcp.json` this module writes. */
export interface CursorMcpConfig {
  mcpServers: Record<string, CursorMcpServerConfig>;
}

/** Options for wiring the RevealUI governed MCP endpoint into a Cursor config. */
export interface CursorMcpOptions {
  /** RevealUI governed MCP endpoint, e.g. `https://your-host/api/mcp`. */
  mcpUrl: string;
  /**
   * Name of the environment variable Cursor resolves via its `${env:VAR}`
   * substitution at runtime (default `REVEALUI_MCP_TOKEN`). Only the
   * variable NAME is ever emitted -- see `protocolConfigToCursorMcpConfig`.
   */
  tokenEnvVar?: string;
}

const DEFAULT_CURSOR_TOKEN_ENV_VAR = 'REVEALUI_MCP_TOKEN';

/**
 * Convert a ProtocolConfig to a `.cursor/mcp.json` fragment wiring the
 * RevealUI governed MCP endpoint (multi-editor harness design doc §3-A).
 *
 * SECURITY-CRITICAL: this function must never emit a literal bearer token,
 * only the `${env:VAR}` substitution syntax Cursor resolves at runtime
 * (verified 2026-07-17 against cursor.com/docs/context/mcp -- Cursor's
 * interpolation syntax is `${env:NAME}`, distinct from OpenCode's
 * `{env:NAME}` above). It deliberately does NOT read
 * `config.environment.variables` for a token value -- the Authorization
 * header is built exclusively from the `tokenEnvVar` NAME, mirroring
 * `protocolConfigToOpencodeConfig`'s leak-proof pattern so no caller can
 * smuggle a literal secret into the emitted config via `environment.variables`.
 *
 * `_config` is accepted (matching `protocolConfigToOpencodeConfig`'s
 * signature, and preserving room for future permission/rule wiring once
 * `.cursor/mcp.json` documents a permission field) but is not read at all --
 * see the security note above.
 */
export function protocolConfigToCursorMcpConfig(
  _config: ProtocolConfig,
  opts: CursorMcpOptions,
): CursorMcpConfig {
  const tokenEnvVar = opts.tokenEnvVar ?? DEFAULT_CURSOR_TOKEN_ENV_VAR;

  return {
    mcpServers: {
      revealui: {
        url: opts.mcpUrl,
        headers: { Authorization: `Bearer \${env:${tokenEnvVar}}` },
      },
    },
  };
}

// -- .mcp.json for a VS Code agent plugin (write-only) -----------------------------

/** VS Code remote/HTTP MCP server entry (`.mcp.json` `servers.<name>`, `type: 'http'`). */
export interface VSCodeMcpServerConfig {
  type: 'http';
  url: string;
  headers: Record<string, string>;
}

/** One `inputs[]` entry -- VS Code prompts for the value on first server start and stores it. */
export interface VSCodeMcpInput {
  type: 'promptString';
  id: string;
  description: string;
  password: true;
}

/** Subset of a VS Code agent plugin's `.mcp.json` this module writes. */
export interface VSCodeMcpConfig {
  inputs: VSCodeMcpInput[];
  servers: Record<string, VSCodeMcpServerConfig>;
}

/** Options for wiring the RevealUI governed MCP endpoint into a VS Code agent-plugin `.mcp.json`. */
export interface VSCodeMcpOptions {
  /** RevealUI governed MCP endpoint, e.g. `https://your-host/api/mcp`. */
  mcpUrl: string;
  /**
   * `inputs[].id` VS Code prompts the user for and substitutes via
   * `${input:id}` (default `revealui-mcp-token`). Only the input id is ever
   * emitted -- see `protocolConfigToVSCodeMcpConfig`.
   */
  tokenInputId?: string;
}

const DEFAULT_VSCODE_TOKEN_INPUT_ID = 'revealui-mcp-token';

/**
 * Convert a ProtocolConfig to a VS Code agent-plugin `.mcp.json` fragment
 * wiring the RevealUI governed MCP endpoint (multi-editor harness design doc
 * §3-A). Mirrors `protocolConfigToCursorMcpConfig`'s leak-proof pattern and
 * split: `VSCodeGenerator.generateAll` (`../content/generators/vscode.ts`)
 * emits only the plugin's `plugin.json` (hook contributions); `.mcp.json`
 * needs an MCP URL + token-input-id option the `ContentGenerator.generateAll`
 * signature doesn't carry, so it lives here instead, matching the split
 * Phase B established for Cursor.
 *
 * SECURITY-CRITICAL: this function must never emit a literal bearer token,
 * only VS Code's `${input:id}` reference syntax (verified 2026-07-17 against
 * code.visualstudio.com/docs/agents/reference/mcp-configuration -- an
 * `inputs[]` entry of `type: 'promptString'` with `password: true` masks the
 * value VS Code prompts for and stores it; the server config references it
 * via `${input:<id>}`, never a literal). It deliberately does NOT read
 * `config.environment.variables` for a token value -- the Authorization
 * header is built exclusively from the `tokenInputId` NAME, so no caller can
 * smuggle a literal secret into the emitted config via
 * `environment.variables`.
 *
 * `_config` is accepted (matching `protocolConfigToCursorMcpConfig`'s and
 * `protocolConfigToOpencodeConfig`'s signatures, preserving room for future
 * permission/rule wiring) but is not read at all -- see the security note
 * above.
 */
export function protocolConfigToVSCodeMcpConfig(
  _config: ProtocolConfig,
  opts: VSCodeMcpOptions,
): VSCodeMcpConfig {
  const tokenInputId = opts.tokenInputId ?? DEFAULT_VSCODE_TOKEN_INPUT_ID;

  return {
    inputs: [
      {
        type: 'promptString',
        id: tokenInputId,
        description: 'RevealUI governed MCP device token',
        password: true,
      },
    ],
    servers: {
      revealui: {
        type: 'http',
        url: opts.mcpUrl,
        headers: { Authorization: `Bearer \${input:${tokenInputId}}` },
      },
    },
  };
}

// -- Helpers ---------------------------------------------------------------------

/** Render rule content, substituting template variables. */
function renderRuleContent(rule: ProtocolRule): string {
  let content = rule.content;
  for (const [key, value] of Object.entries(rule.variables)) {
    content = content.split(`{{${key}}}`).join(value);
  }
  return content;
}
