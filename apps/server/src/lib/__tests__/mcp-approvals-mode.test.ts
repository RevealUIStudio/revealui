/**
 * REVEALUI_MCP_APPROVALS_MODE: off by default, shadow and enforce explicit,
 * any other non-empty value fails closed to enforce.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { configureMcpApprovalsMode, currentMcpApprovalsMode } from '../mcp-approvals-mode.js';

const ENV_KEY = 'REVEALUI_MCP_APPROVALS_MODE';

afterEach(() => {
  configureMcpApprovalsMode(null);
  delete process.env[ENV_KEY];
});

describe('MCP approvals mode', () => {
  it('defaults to off when the env var is unset or empty', () => {
    delete process.env[ENV_KEY];
    expect(currentMcpApprovalsMode()).toBe('off');
    process.env[ENV_KEY] = '';
    expect(currentMcpApprovalsMode()).toBe('off');
  });

  it('reads off, shadow, and enforce', () => {
    process.env[ENV_KEY] = 'off';
    expect(currentMcpApprovalsMode()).toBe('off');
    process.env[ENV_KEY] = 'shadow';
    expect(currentMcpApprovalsMode()).toBe('shadow');
    process.env[ENV_KEY] = 'enforce';
    expect(currentMcpApprovalsMode()).toBe('enforce');
  });

  it('fails closed to enforce for an unknown value', () => {
    process.env[ENV_KEY] = 'TRUE';
    expect(currentMcpApprovalsMode()).toBe('enforce');
  });

  it('lets a test override beat the env var', () => {
    process.env[ENV_KEY] = 'off';
    configureMcpApprovalsMode('shadow');
    expect(currentMcpApprovalsMode()).toBe('shadow');
  });
});
