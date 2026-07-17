import { describe, expect, it } from 'vitest';
import type { ProtocolConfig } from '../protocol/adapter.js';
import { protocolConfigToCursorMcpConfig } from '../protocol/config-normalizer.js';

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

describe('protocolConfigToCursorMcpConfig', () => {
  it("emits the .cursor/mcp.json remote server block using Cursor's env-interpolation syntax", () => {
    const config = createTestConfig();
    const result = protocolConfigToCursorMcpConfig(config, {
      mcpUrl: 'https://your-host/api/mcp',
    });

    expect(result.mcpServers.revealui).toEqual({
      url: 'https://your-host/api/mcp',
      headers: { Authorization: `Bearer \${env:REVEALUI_MCP_TOKEN}` },
    });
  });

  it('respects a custom token env var name', () => {
    const config = createTestConfig();
    const result = protocolConfigToCursorMcpConfig(config, {
      mcpUrl: 'https://your-host/api/mcp',
      tokenEnvVar: 'CUSTOM_TOKEN_VAR',
    });
    expect(result.mcpServers.revealui.headers.Authorization).toBe(
      `Bearer \${env:CUSTOM_TOKEN_VAR}`,
    );
  });

  describe('SECURITY / design invariant I-4: never emits a literal bearer token', () => {
    it('does not leak a token planted in config.environment.variables', () => {
      const config = createTestConfig({
        environment: {
          variables: { REVEALUI_MCP_TOKEN: 'rvui_dev_should_never_appear_in_output' },
          mcpServers: [],
        },
      });
      const result = protocolConfigToCursorMcpConfig(config, { mcpUrl: 'https://host/api/mcp' });
      const serialized = JSON.stringify(result);

      expect(serialized).not.toContain('rvui_dev_should_never_appear_in_output');
      expect(result.mcpServers.revealui.headers.Authorization).toBe(
        `Bearer \${env:REVEALUI_MCP_TOKEN}`,
      );
    });

    it('never emits a token value present in process.env', () => {
      const priorValue = process.env.REVEALUI_MCP_TOKEN_TEST_FIXTURE;
      process.env.REVEALUI_MCP_TOKEN_TEST_FIXTURE = 'sk-should-not-leak-into-config';
      try {
        const config = createTestConfig();
        const result = protocolConfigToCursorMcpConfig(config, {
          mcpUrl: 'https://host/api/mcp',
          tokenEnvVar: 'REVEALUI_MCP_TOKEN_TEST_FIXTURE',
        });
        const serialized = JSON.stringify(result);

        expect(serialized).not.toContain('sk-should-not-leak-into-config');
        expect(serialized).toContain(`\${env:REVEALUI_MCP_TOKEN_TEST_FIXTURE}`);
      } finally {
        if (priorValue === undefined) {
          delete process.env.REVEALUI_MCP_TOKEN_TEST_FIXTURE;
        } else {
          process.env.REVEALUI_MCP_TOKEN_TEST_FIXTURE = priorValue;
        }
      }
    });
  });
});
