import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let testLocalPath = '';
let testRootPath = '';

vi.mock('../config/harness-config-paths.js', () => ({
  getLocalConfigPath: (id: string) => (id === 'test-harness' ? testLocalPath : null),
  getRootConfigPath: (id: string) => (id === 'test-harness' ? testRootPath : null),
  getConfigurableHarnesses: () => ['test-harness'],
}));

import {
  diffAllConfigs,
  diffConfig,
  syncAllConfigs,
  syncConfig,
  validateConfigJson,
} from '../config/config-sync.js';

describe('config-sync', () => {
  let testRoot: string;

  beforeEach(() => {
    testRoot = join(
      tmpdir(),
      `config-sync-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    const localDir = join(testRoot, 'local');
    const rootDir = join(testRoot, 'root');
    mkdirSync(localDir, { recursive: true });
    mkdirSync(rootDir, { recursive: true });
    testLocalPath = join(localDir, 'config.json');
    testRootPath = join(rootDir, 'config.json');
  });

  afterEach(() => {
    try {
      rmSync(testRoot, { recursive: true, force: true });
    } catch {}
  });

  describe('syncConfig', () => {
    it('returns error for unknown harness', () => {
      const result = syncConfig('unknown', 'push');
      expect(result.success).toBe(false);
      expect(result.message).toContain('No config path known');
    });

    it('returns error when local file missing for push', () => {
      const result = syncConfig('test-harness', 'push');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Local config not found');
    });

    it('returns error when root file missing for pull', () => {
      const result = syncConfig('test-harness', 'pull');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Root config not found');
    });

    it('pushes local to root successfully', () => {
      writeFileSync(testLocalPath, '{"pushed":true}');
      const result = syncConfig('test-harness', 'push');
      expect(result.success).toBe(true);
      expect(result.message).toContain('Pushed');
      expect(readFileSync(testRootPath, 'utf8')).toBe('{"pushed":true}');
    });

    it('pulls root to local successfully', () => {
      writeFileSync(testRootPath, '{"pulled":true}');
      const result = syncConfig('test-harness', 'pull');
      expect(result.success).toBe(true);
      expect(result.message).toContain('Pulled');
      expect(readFileSync(testLocalPath, 'utf8')).toBe('{"pulled":true}');
    });

    it('creates .bak backup before overwriting on push', () => {
      writeFileSync(testLocalPath, '{"new":true}');
      writeFileSync(testRootPath, '{"old":true}');
      syncConfig('test-harness', 'push');
      expect(existsSync(`${testRootPath}.bak`)).toBe(true);
      expect(readFileSync(`${testRootPath}.bak`, 'utf8')).toBe('{"old":true}');
    });

    it('creates .bak backup before overwriting on pull', () => {
      writeFileSync(testRootPath, '{"new":true}');
      writeFileSync(testLocalPath, '{"old":true}');
      syncConfig('test-harness', 'pull');
      expect(existsSync(`${testLocalPath}.bak`)).toBe(true);
      expect(readFileSync(`${testLocalPath}.bak`, 'utf8')).toBe('{"old":true}');
    });
  });

  describe('diffConfig', () => {
    it('reports both missing as not identical', () => {
      const result = diffConfig('test-harness');
      expect(result.identical).toBe(false);
      expect(result.localExists).toBe(false);
      expect(result.ssdExists).toBe(false);
    });

    it('reports identical when files match', () => {
      writeFileSync(testLocalPath, '{"key":"value"}');
      writeFileSync(testRootPath, '{"key":"value"}');
      const result = diffConfig('test-harness');
      expect(result.identical).toBe(true);
      expect(result.localExists).toBe(true);
      expect(result.ssdExists).toBe(true);
    });

    it('reports not identical when files differ', () => {
      writeFileSync(testLocalPath, '{"key":"a"}');
      writeFileSync(testRootPath, '{"key":"b"}');
      const result = diffConfig('test-harness');
      expect(result.identical).toBe(false);
    });

    it('reports unknown harness as missing', () => {
      const result = diffConfig('unknown');
      expect(result.localExists).toBe(false);
      expect(result.ssdExists).toBe(false);
    });
  });

  describe('syncAllConfigs', () => {
    it('syncs all configurable harnesses', () => {
      writeFileSync(testLocalPath, '{"all":true}');
      const results = syncAllConfigs('push');
      expect(results).toHaveLength(1);
      expect(results[0]?.harnessId).toBe('test-harness');
    });
  });

  describe('diffAllConfigs', () => {
    it('diffs all configurable harnesses', () => {
      const results = diffAllConfigs();
      expect(results).toHaveLength(1);
      expect(results[0]?.harnessId).toBe('test-harness');
    });
  });

  describe('validateConfigJson', () => {
    it('returns error for unknown harness', () => {
      const result = validateConfigJson('unknown');
      expect(result).toContain('No config path known');
    });

    it('returns error when file not found', () => {
      const result = validateConfigJson('test-harness');
      expect(result).toContain('Config file not found');
    });

    it('returns null for valid JSON', () => {
      writeFileSync(testLocalPath, '{"valid":true}');
      const result = validateConfigJson('test-harness');
      expect(result).toBeNull();
    });

    it('returns error for invalid JSON', () => {
      writeFileSync(testLocalPath, '{not valid json');
      const result = validateConfigJson('test-harness');
      expect(result).toBeTruthy();
    });
  });
});
