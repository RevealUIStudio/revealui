import { describe, expect, it } from 'vitest';
import type { ProtocolConfig } from '../protocol/adapter.js';
import { protocolConfigToVSCodeMcpConfig } from '../protocol/config-normalizer.js';

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

describe('protocolConfigToVSCodeMcpConfig', () => {
  it("emits the .mcp.json remote server block using VS Code's input-reference substitution syntax", () => {
    const config = createTestConfig();
    const result = protocolConfigToVSCodeMcpConfig(config, {
      mcpUrl: 'https://your-host/api/mcp',
    });

    expect(result.servers.revealui).toEqual({
      type: 'http',
      url: 'https://your-host/api/mcp',
      headers: { Authorization: `Bearer \${input:revealui-mcp-token}` },
    });
    expect(result.inputs).toEqual([
      {
        type: 'promptString',
        id: 'revealui-mcp-token',
        description: 'RevealUI governed MCP device token',
        password: true,
      },
    ]);
  });

  it('respects a custom token input id', () => {
    const config = createTestConfig();
    const result = protocolConfigToVSCodeMcpConfig(config, {
      mcpUrl: 'https://your-host/api/mcp',
      tokenInputId: 'custom-token-id',
    });
    expect(result.servers.revealui.headers.Authorization).toBe(`Bearer \${input:custom-token-id}`);
    expect(result.inputs[0]?.id).toBe('custom-token-id');
  });

  it('marks the input password: true so VS Code masks the prompt', () => {
    const config = createTestConfig();
    const result = protocolConfigToVSCodeMcpConfig(config, { mcpUrl: 'https://host/api/mcp' });
    expect(result.inputs[0]?.password).toBe(true);
  });

  describe('SECURITY / design invariant I-4: never emits a literal bearer token', () => {
    it('does not leak a token planted in config.environment.variables', () => {
      const config = createTestConfig({
        environment: {
          variables: { REVEALUI_MCP_TOKEN: 'rvui_dev_should_never_appear_in_output' },
          mcpServers: [],
        },
      });
      const result = protocolConfigToVSCodeMcpConfig(config, { mcpUrl: 'https://host/api/mcp' });
      const serialized = JSON.stringify(result);

      expect(serialized).not.toContain('rvui_dev_should_never_appear_in_output');
      expect(result.servers.revealui.headers.Authorization).toBe(
        `Bearer \${input:revealui-mcp-token}`,
      );
    });

    it('never emits a token value present in process.env', () => {
      const priorValue = process.env.REVEALUI_MCP_TOKEN_TEST_FIXTURE_VSCODE;
      process.env.REVEALUI_MCP_TOKEN_TEST_FIXTURE_VSCODE = 'sk-should-not-leak-into-config';
      try {
        const config = createTestConfig();
        const result = protocolConfigToVSCodeMcpConfig(config, {
          mcpUrl: 'https://host/api/mcp',
          tokenInputId: 'revealui-mcp-token-test-fixture-vscode',
        });
        const serialized = JSON.stringify(result);

        expect(serialized).not.toContain('sk-should-not-leak-into-config');
        expect(serialized).toContain('$' + '{input:revealui-mcp-token-test-fixture-vscode}');
      } finally {
        if (priorValue === undefined) {
          delete process.env.REVEALUI_MCP_TOKEN_TEST_FIXTURE_VSCODE;
        } else {
          process.env.REVEALUI_MCP_TOKEN_TEST_FIXTURE_VSCODE = priorValue;
        }
      }
    });
  });
});
