import { describe, expect, it } from 'vitest';
import { authorizeMcpTool, MCP_TOOL_NAMES } from '../mcp-tool-access.js';

describe('authorizeMcpTool knowledge-graph grants', () => {
  it('lists the seven kg_* names on the closed union', () => {
    expect(MCP_TOOL_NAMES).toContain('kg_search');
    expect(MCP_TOOL_NAMES).toContain('kg_get_node');
    expect(MCP_TOOL_NAMES).toContain('kg_neighbors');
    expect(MCP_TOOL_NAMES).toContain('kg_path');
    expect(MCP_TOOL_NAMES).toContain('kg_at_time');
    expect(MCP_TOOL_NAMES).toContain('kg_context');
    expect(MCP_TOOL_NAMES).toContain('kg_add_episode');
  });

  it('lets a viewer read kg tools but not kg_add_episode', () => {
    const viewer = { role: 'viewer', tier: 'pro' as const };
    expect(authorizeMcpTool(viewer, 'kg_search')).toBe(true);
    expect(authorizeMcpTool(viewer, 'kg_context')).toBe(true);
    expect(authorizeMcpTool(viewer, 'kg_add_episode')).toBe(false);
  });

  it('lets editor, agent, contributor, admin, and owner write kg_add_episode', () => {
    for (const role of ['editor', 'agent', 'contributor', 'admin', 'owner']) {
      expect(authorizeMcpTool({ role, tier: 'free' }, 'kg_add_episode')).toBe(true);
      expect(authorizeMcpTool({ role, tier: 'free' }, 'kg_search')).toBe(true);
    }
  });

  it('keeps kg tools on every tier (mcp feature already gated the mount)', () => {
    expect(authorizeMcpTool({ role: 'viewer', tier: 'free' }, 'kg_search')).toBe(true);
    expect(authorizeMcpTool({ role: 'editor', tier: 'free' }, 'kg_add_episode')).toBe(true);
  });

  it('denies unknown tools and unknown roles', () => {
    expect(authorizeMcpTool({ role: 'viewer', tier: 'pro' }, 'kg_publish')).toBe(false);
    expect(authorizeMcpTool({ role: 'intern', tier: 'pro' }, 'kg_search')).toBe(false);
  });
});
