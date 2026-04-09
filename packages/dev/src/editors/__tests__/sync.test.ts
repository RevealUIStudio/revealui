import { beforeEach, describe, expect, it, vi } from 'vitest';
import { syncEditorConfigs } from '../sync.js';

// ---------------------------------------------------------------------------
// Mock node:fs/promises
// ---------------------------------------------------------------------------

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

import * as fs from 'node:fs/promises';

const mockReadFile = vi.mocked(fs.readFile);
const mockWriteFile = vi.mocked(fs.writeFile);
vi.mocked(fs.mkdir);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('syncEditorConfigs', () => {
  const ROOT = '/project';

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: files don't exist yet (readFile throws ENOENT)
    mockReadFile.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
  });

  describe('vscode', () => {
    it('writes settings.json and extensions.json to .vscode/', async () => {
      const result = await syncEditorConfigs({ rootDir: ROOT, editors: ['vscode'] });

      const written = result.written;
      expect(written).toContain(`${ROOT}/.vscode/settings.json`);
      expect(written).toContain(`${ROOT}/.vscode/extensions.json`);
      expect(result.errors).toHaveLength(0);
    });

    it('skips files that are already up to date', async () => {
      // First run to get the content that would be written
      const { generateVSCodeSettings, generateVSCodeExtensions } = await import(
        '../vscode/index.js'
      );
      const settingsContent = `${JSON.stringify(generateVSCodeSettings(), null, 2)}\n`;
      const extensionsContent = `${JSON.stringify(generateVSCodeExtensions(), null, 2)}\n`;

      mockReadFile
        .mockResolvedValueOnce(settingsContent as never)
        .mockResolvedValueOnce(extensionsContent as never);

      const result = await syncEditorConfigs({ rootDir: ROOT, editors: ['vscode'] });

      expect(result.written).toHaveLength(0);
      expect(result.skipped).toContain(`${ROOT}/.vscode/settings.json`);
      expect(result.skipped).toContain(`${ROOT}/.vscode/extensions.json`);
    });
  });

  describe('zed', () => {
    it('writes .zed/settings.json', async () => {
      const result = await syncEditorConfigs({ rootDir: ROOT, editors: ['zed'] });

      expect(result.written).toContain(`${ROOT}/.zed/settings.json`);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('antigravity', () => {
    it('writes .vscode/ configs and .agents/rules/revealui.md', async () => {
      const result = await syncEditorConfigs({ rootDir: ROOT, editors: ['antigravity'] });

      expect(result.written).toContain(`${ROOT}/.vscode/settings.json`);
      expect(result.written).toContain(`${ROOT}/.vscode/extensions.json`);
      expect(result.written).toContain(`${ROOT}/.agents/rules/revealui.md`);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('all editors', () => {
    it('deduplicates .vscode/ writes when multiple editors share them', async () => {
      const result = await syncEditorConfigs({
        rootDir: ROOT,
        editors: ['vscode', 'antigravity', 'zed'],
      });

      const allPaths = [...result.written, ...result.skipped];
      const settingsOccurrences = allPaths.filter((p) => p.endsWith('settings.json'));
      // .vscode/settings.json should appear at most once (written or skipped)
      expect(settingsOccurrences.filter((p) => p.includes('.vscode')).length).toBeLessThanOrEqual(
        1,
      );
    });

    it('writes all expected files when no editors specified (defaults to all)', async () => {
      const result = await syncEditorConfigs({ rootDir: ROOT });

      const allPaths = [...result.written, ...result.skipped];
      expect(allPaths).toContain(`${ROOT}/.vscode/settings.json`);
      expect(allPaths).toContain(`${ROOT}/.vscode/extensions.json`);
      expect(allPaths).toContain(`${ROOT}/.zed/settings.json`);
      expect(allPaths).toContain(`${ROOT}/.agents/rules/revealui.md`);
    });
  });

  describe('error handling', () => {
    it('captures writeFile errors in result.errors', async () => {
      mockWriteFile.mockRejectedValue(new Error('permission denied'));

      const result = await syncEditorConfigs({ rootDir: ROOT, editors: ['zed'] });

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.error).toContain('permission denied');
      expect(result.written).toHaveLength(0);
    });
  });
});
