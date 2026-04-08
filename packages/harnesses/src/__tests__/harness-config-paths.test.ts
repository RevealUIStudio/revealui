import { describe, expect, it } from 'vitest';
import {
  getConfigurableHarnesses,
  getLocalConfigPath,
  getRootConfigPath,
} from '../config/harness-config-paths.js';

describe('harness-config-paths', () => {
  it('returns known configurable harness ids', () => {
    const ids = getConfigurableHarnesses();
    expect(ids).toContain('claude-code');
    expect(ids).toContain('cursor');
    expect(ids).toContain('copilot');
  });

  it('returns local config path for claude-code', () => {
    const p = getLocalConfigPath('claude-code');
    expect(p).toBeDefined();
    expect(p).toMatch(/\.claude\/settings\.json$/);
  });

  it('returns local config path for cursor', () => {
    const p = getLocalConfigPath('cursor');
    expect(p).toBeDefined();
    expect(p).toMatch(/\.cursor\/settings\.json$/);
  });

  it('returns undefined for unknown harness', () => {
    expect(getLocalConfigPath('unknown-tool')).toBeUndefined();
  });

  it('returns root config path with custom base', () => {
    const p = getRootConfigPath('claude-code', '/mnt/e/.revealui');
    expect(p).toBeDefined();
    expect(p).toContain('harness-configs/claude-code');
    expect(p).toContain('settings.json');
  });

  it('returns undefined root path for unknown harness', () => {
    expect(getRootConfigPath('unknown', '/mnt/e/.revealui')).toBeUndefined();
  });
});
