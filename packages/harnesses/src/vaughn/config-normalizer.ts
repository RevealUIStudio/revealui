/**
 * VAUGHN Config Normalization (Section 6 of VAUGHN.md)
 *
 * Bidirectional: VaughnConfig <-> Claude Code settings.json
 * Write-only: VaughnConfig -> .cursorrules markdown
 * Write-only: VaughnConfig -> AGENTS.md markdown
 */

import type { VaughnConfig, VaughnRule } from './adapter.js';
import { VAUGHN_VERSION } from './event-envelope.js';

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

// -- Claude Code settings.json <-> VaughnConfig ---------------------------------

/** Subset of Claude Code settings.json we read/write. */
export interface ClaudeCodeSettings {
  permissions?: {
    allow?: string[];
    deny?: string[];
  };
  env?: Record<string, string>;
  mcpServers?: Record<string, { command: string; args?: string[]; env?: Record<string, string> }>;
}

/** Convert a VaughnConfig to Claude Code settings.json format. */
export function vaughnConfigToClaudeSettings(config: VaughnConfig): ClaudeCodeSettings {
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

/** Parse Claude Code settings.json into a partial VaughnConfig. */
export function claudeSettingsToVaughnConfig(settings: ClaudeCodeSettings): Partial<VaughnConfig> {
  const config: Partial<VaughnConfig> = {};

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

/** Generate .cursorrules markdown from VaughnConfig. */
export function vaughnConfigToCursorrules(config: VaughnConfig): string {
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

/** Generate AGENTS.md markdown from VaughnConfig. */
export function vaughnConfigToAgentsMd(config: VaughnConfig): string {
  const lines: string[] = [];

  lines.push('# AGENTS.md');
  lines.push('');
  lines.push(`> Generated by VAUGHN protocol v${VAUGHN_VERSION}`);
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
 * Generate all config files from a VaughnConfig.
 * Returns a map of relative file paths to contents.
 */
export function generateAllConfigs(config: VaughnConfig): ConfigGenerationResult {
  const files = new Map<string, string>();

  // Claude Code settings.json
  files.set('.claude/settings.json', JSON.stringify(vaughnConfigToClaudeSettings(config), null, 2));

  // .cursorrules
  files.set('.cursorrules', vaughnConfigToCursorrules(config));

  // AGENTS.md
  files.set('AGENTS.md', vaughnConfigToAgentsMd(config));

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

// -- Helpers ---------------------------------------------------------------------

/** Render rule content, substituting template variables. */
function renderRuleContent(rule: VaughnRule): string {
  let content = rule.content;
  for (const [key, value] of Object.entries(rule.variables)) {
    content = content.split(`{{${key}}}`).join(value);
  }
  return content;
}
