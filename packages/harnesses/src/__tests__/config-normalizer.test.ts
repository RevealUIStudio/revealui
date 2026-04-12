import { describe, expect, it } from 'vitest';
import type { VaughnConfig } from '../vaughn/adapter.js';
import {
  claudeSettingsToVaughnConfig,
  generateAllConfigs,
  vaughnConfigToAgentsMd,
  vaughnConfigToClaudeSettings,
  vaughnConfigToCursorrules,
} from '../vaughn/config-normalizer.js';

function createTestConfig(overrides: Partial<VaughnConfig> = {}): VaughnConfig {
  return {
    identity: { name: 'Test Agent', email: 'test@example.com', role: 'builder' },
    permissions: { autoApprove: ['Read', 'Glob'], deny: ['Write'] },
    environment: {
      variables: { NODE_ENV: 'development' },
      mcpServers: [
        {
          name: 'github',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github'],
          env: { GITHUB_TOKEN: 'ghp_xxx' },
        },
      ],
    },
    rules: [
      {
        id: 'biome',
        description: 'Use Biome for formatting',
        content: 'Format with {{formatter}}.',
        appliesTo: ['*.ts', '*.tsx'],
        variables: { formatter: 'biome' },
      },
    ],
    skills: [
      {
        id: 'tdd',
        name: 'TDD Workflow',
        description: 'Test-driven development',
        instructions: 'Write tests first, then implementation.',
      },
    ],
    commands: [
      {
        id: 'gate',
        name: 'Gate',
        description: 'Run quality gate',
        steps: ['Run lint', 'Run typecheck', 'Run tests'],
      },
    ],
    ...overrides,
  };
}

describe('vaughnConfigToClaudeSettings', () => {
  it('converts permissions', () => {
    const config = createTestConfig();
    const settings = vaughnConfigToClaudeSettings(config);
    expect(settings.permissions?.allow).toEqual(['Read', 'Glob']);
    expect(settings.permissions?.deny).toEqual(['Write']);
  });

  it('converts environment variables', () => {
    const config = createTestConfig();
    const settings = vaughnConfigToClaudeSettings(config);
    expect(settings.env?.NODE_ENV).toBe('development');
  });

  it('converts MCP servers', () => {
    const config = createTestConfig();
    const settings = vaughnConfigToClaudeSettings(config);
    expect(settings.mcpServers?.github).toBeDefined();
    expect(settings.mcpServers?.github.command).toBe('npx');
    expect(settings.mcpServers?.github.args).toEqual(['-y', '@modelcontextprotocol/server-github']);
    expect(settings.mcpServers?.github.env?.GITHUB_TOKEN).toBe('ghp_xxx');
  });

  it('omits empty sections', () => {
    const config = createTestConfig({
      permissions: { autoApprove: [], deny: [] },
      environment: { variables: {}, mcpServers: [] },
    });
    const settings = vaughnConfigToClaudeSettings(config);
    expect(settings.permissions).toBeUndefined();
    expect(settings.env).toBeUndefined();
    expect(settings.mcpServers).toBeUndefined();
  });
});

describe('claudeSettingsToVaughnConfig', () => {
  it('parses permissions', () => {
    const settings = {
      permissions: { allow: ['Read'], deny: ['Bash'] },
    };
    const config = claudeSettingsToVaughnConfig(settings);
    expect(config.permissions?.autoApprove).toEqual(['Read']);
    expect(config.permissions?.deny).toEqual(['Bash']);
  });

  it('parses MCP servers', () => {
    const settings = {
      mcpServers: {
        github: { command: 'npx', args: ['-y', 'gh-server'], env: { TOKEN: 'x' } },
      },
    };
    const config = claudeSettingsToVaughnConfig(settings);
    expect(config.environment?.mcpServers).toHaveLength(1);
    expect(config.environment?.mcpServers[0].name).toBe('github');
    expect(config.environment?.mcpServers[0].command).toBe('npx');
  });

  it('handles empty settings', () => {
    const config = claudeSettingsToVaughnConfig({});
    expect(config.environment?.variables).toEqual({});
    expect(config.environment?.mcpServers).toEqual([]);
  });

  it('round-trips permissions through Claude settings', () => {
    const original = createTestConfig();
    const settings = vaughnConfigToClaudeSettings(original);
    const parsed = claudeSettingsToVaughnConfig(settings);
    expect(parsed.permissions?.autoApprove).toEqual(original.permissions.autoApprove);
    expect(parsed.permissions?.deny).toEqual(original.permissions.deny);
  });
});

describe('vaughnConfigToCursorrules', () => {
  it('includes identity', () => {
    const config = createTestConfig();
    const md = vaughnConfigToCursorrules(config);
    expect(md).toContain('# Project Rules');
    expect(md).toContain('- Name: Test Agent');
    expect(md).toContain('- Role: builder');
  });

  it('includes rules with variable substitution', () => {
    const config = createTestConfig();
    const md = vaughnConfigToCursorrules(config);
    expect(md).toContain('### biome');
    expect(md).toContain('Format with biome.');
  });

  it('includes skills', () => {
    const config = createTestConfig();
    const md = vaughnConfigToCursorrules(config);
    expect(md).toContain('### TDD Workflow');
    expect(md).toContain('Write tests first');
  });

  it('omits role when not set', () => {
    const config = createTestConfig({ identity: { name: 'X', email: 'x@y.com' } });
    const md = vaughnConfigToCursorrules(config);
    expect(md).not.toContain('- Role:');
  });
});

describe('vaughnConfigToAgentsMd', () => {
  it('includes header and version', () => {
    const config = createTestConfig();
    const md = vaughnConfigToAgentsMd(config);
    expect(md).toContain('# AGENTS.md');
    expect(md).toContain('VAUGHN protocol v0.1.0');
  });

  it('includes identity', () => {
    const config = createTestConfig();
    const md = vaughnConfigToAgentsMd(config);
    expect(md).toContain('- Name: Test Agent');
    expect(md).toContain('- Email: test@example.com');
  });

  it('includes denied operations', () => {
    const config = createTestConfig();
    const md = vaughnConfigToAgentsMd(config);
    expect(md).toContain('## Denied Operations');
    expect(md).toContain('- Write');
  });

  it('includes rules with appliesTo', () => {
    const config = createTestConfig();
    const md = vaughnConfigToAgentsMd(config);
    expect(md).toContain('### biome');
    expect(md).toContain('Applies to: *.ts, *.tsx');
  });

  it('includes commands with steps', () => {
    const config = createTestConfig();
    const md = vaughnConfigToAgentsMd(config);
    expect(md).toContain('### /gate');
    expect(md).toContain('1. Run lint');
    expect(md).toContain('2. Run typecheck');
    expect(md).toContain('3. Run tests');
  });
});

describe('generateAllConfigs', () => {
  it('generates all three output files', () => {
    const config = createTestConfig();
    const result = generateAllConfigs(config);
    expect(result.files.has('.claude/settings.json')).toBe(true);
    expect(result.files.has('.cursorrules')).toBe(true);
    expect(result.files.has('AGENTS.md')).toBe(true);
  });

  it('generates per-rule Claude rule files', () => {
    const config = createTestConfig();
    const result = generateAllConfigs(config);
    expect(result.files.has('.claude/rules/biome.md')).toBe(true);
    const ruleContent = result.files.get('.claude/rules/biome.md')!;
    expect(ruleContent).toContain('---');
    expect(ruleContent).toContain('description: Use Biome for formatting');
    expect(ruleContent).toContain('globs: *.ts, *.tsx');
    expect(ruleContent).toContain('Format with biome.');
  });

  it('settings.json is valid JSON', () => {
    const config = createTestConfig();
    const result = generateAllConfigs(config);
    const json = result.files.get('.claude/settings.json')!;
    expect(() => JSON.parse(json)).not.toThrow();
  });
});
