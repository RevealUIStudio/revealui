import { describe, expect, it } from 'vitest';
import type { ProtocolConfig } from '../protocol/adapter.js';
import { protocolConfigToOpencodeConfig } from '../protocol/config-normalizer.js';

function createTestConfig(overrides: Partial<ProtocolConfig> = {}): ProtocolConfig {
  return {
    identity: { name: 'Test Agent', email: 'test@example.com', role: 'builder' },
    permissions: { autoApprove: ['Read', 'Glob'], deny: ['Write'] },
    environment: { variables: {}, mcpServers: [] },
    rules: [],
    skills: [],
    commands: [],
    ...overrides,
  };
}

describe('protocolConfigToOpencodeConfig', () => {
  it('emits the design-doc §5.7 remote MCP block', () => {
    const config = createTestConfig();
    const result = protocolConfigToOpencodeConfig(config, {
      mcpUrl: 'https://your-host/api/mcp',
    });

    expect(result.mcp?.revealui).toEqual({
      type: 'remote',
      url: 'https://your-host/api/mcp',
      headers: { Authorization: 'Bearer {env:REVEALUI_MCP_TOKEN}' },
      oauth: false,
      enabled: true,
    });
    expect(result.tools).toEqual({ 'revealui*': true });
  });

  it('respects a custom token env var name', () => {
    const config = createTestConfig();
    const result = protocolConfigToOpencodeConfig(config, {
      mcpUrl: 'https://your-host/api/mcp',
      tokenEnvVar: 'CUSTOM_TOKEN_VAR',
    });
    expect(result.mcp?.revealui.headers.Authorization).toBe('Bearer {env:CUSTOM_TOKEN_VAR}');
  });

  it('maps autoApprove/deny permissions to opencode allow/deny, dropping unsafe keys', () => {
    const config = createTestConfig({
      permissions: {
        autoApprove: ['Read', 'Glob', '__proto__', 'constructor'],
        deny: ['Write', 'prototype'],
      },
    });
    const result = protocolConfigToOpencodeConfig(config, { mcpUrl: 'https://host/api/mcp' });

    expect(result.permission).toEqual({ Read: 'allow', Glob: 'allow', Write: 'deny' });
    expect(result.permission).not.toHaveProperty('__proto__');
    expect(result.permission).not.toHaveProperty('constructor');
    expect(result.permission).not.toHaveProperty('prototype');
  });

  it('omits the permission block entirely when there is nothing to declare', () => {
    const config = createTestConfig({ permissions: { autoApprove: [], deny: [] } });
    const result = protocolConfigToOpencodeConfig(config, { mcpUrl: 'https://host/api/mcp' });
    expect(result.permission).toBeUndefined();
  });

  describe('SECURITY: never emits a literal bearer token', () => {
    it('does not leak a token planted in config.environment.variables', () => {
      const config = createTestConfig({
        environment: {
          variables: { REVEALUI_MCP_TOKEN: 'rvui_dev_should_never_appear_in_output' },
          mcpServers: [],
        },
      });
      const result = protocolConfigToOpencodeConfig(config, { mcpUrl: 'https://host/api/mcp' });
      const serialized = JSON.stringify(result);

      expect(serialized).not.toContain('rvui_dev_should_never_appear_in_output');
      expect(result.mcp?.revealui.headers.Authorization).toBe('Bearer {env:REVEALUI_MCP_TOKEN}');
    });

    it('never emits any token-shaped literal regardless of what environment.variables contains', () => {
      const config = createTestConfig({
        environment: {
          variables: {
            REVEALUI_MCP_TOKEN: 'sk-should-not-leak',
            ANOTHER_SECRET: 'also-should-not-leak',
          },
          mcpServers: [],
        },
      });
      const result = protocolConfigToOpencodeConfig(config, {
        mcpUrl: 'https://host/api/mcp',
        tokenEnvVar: 'REVEALUI_MCP_TOKEN',
      });
      const serialized = JSON.stringify(result);

      // The only string containing "REVEALUI_MCP_TOKEN" allowed in the
      // output is the `{env:...}` substitution placeholder -- never a
      // resolved literal value.
      expect(serialized).not.toContain('sk-should-not-leak');
      expect(serialized).not.toContain('also-should-not-leak');
      expect(serialized).toContain('{env:REVEALUI_MCP_TOKEN}');
    });
  });
});
