/**
 * Tests for File Scanner Utility
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock problematic imports
vi.mock('@revealui/core/monitoring', () => ({
  registerProcess: vi.fn(),
  updateProcessStatus: vi.fn(),
}));

vi.mock('../../../lib/logger.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

import {
  type FileInfo,
  filterByExtension,
  filterByPattern,
  groupByDirectory,
  scanDirectoryRecursive,
  scanFiles,
  scanFilesGenerator,
} from '../../../lib/generators/shared/file-scanner.js';

describe('File Scanner', () => {
  const testDir = join(process.cwd(), '.test-file-scanner');

  beforeEach(() => {
    // Create test directory structure
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Wait a bit for async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Cleanup test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  const createTestFile = (relativePath: string, content: string = 'test content') => {
    const fullPath = join(testDir, relativePath);
    const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(fullPath, content, 'utf-8');
  };

  describe('scanFiles', () => {
    it('should scan files with simple pattern', async () => {
      createTestFile('test1.ts', 'content 1');
      createTestFile('test2.ts', 'content 2');
      createTestFile('test3.js', 'content 3');

      const files = await scanFiles({
        pattern: '*.ts',
        cwd: testDir,
      });

      expect(files).toHaveLength(2);
      expect(files.every((f) => f.path.endsWith('.ts'))).toBe(true);
    });

    it('should scan files with glob pattern', async () => {
      createTestFile('src/file1.ts', 'content');
      createTestFile('src/file2.ts', 'content');
      createTestFile('lib/file3.ts', 'content');

      const files = await scanFiles({
        pattern: '**/*.ts',
        cwd: testDir,
      });

      expect(files.length).toBeGreaterThanOrEqual(3);
    });

    it('should load file content when requested', async () => {
      const content = 'test file content';
      createTestFile('test.ts', content);

      const files = await scanFiles({
        pattern: '*.ts',
        cwd: testDir,
        loadContent: true,
      });

      expect(files).toHaveLength(1);
      expect(files[0].content).toBe(content);
    });

    it('should not load content by default', async () => {
      createTestFile('test.ts', 'content');

      const files = await scanFiles({
        pattern: '*.ts',
        cwd: testDir,
        loadContent: false,
      });

      expect(files).toHaveLength(1);
      expect(files[0].content).toBeUndefined();
    });

    it('should respect ignore patterns', async () => {
      createTestFile('include.ts', 'content');
      createTestFile('node_modules/exclude.ts', 'content');
      createTestFile('dist/exclude.ts', 'content');

      const files = await scanFiles({
        pattern: '**/*.ts',
        cwd: testDir,
        ignore: ['**/node_modules/**', '**/dist/**'],
      });

      expect(files).toHaveLength(1);
      expect(files[0].name).toBe('include.ts');
    });

    it('should filter by extensions', async () => {
      createTestFile('file1.ts', 'content');
      createTestFile('file2.tsx', 'content');
      createTestFile('file3.js', 'content');

      const files = await scanFiles({
        pattern: '**/*',
        cwd: testDir,
        extensions: ['.ts', '.tsx'],
      });

      expect(files).toHaveLength(2);
      expect(files.every((f) => ['.ts', '.tsx'].includes(f.extension))).toBe(true);
    });

    it('should respect maxFileSize option', async () => {
      const smallContent = 'small';
      const largeContent = 'x'.repeat(1000);

      createTestFile('small.ts', smallContent);
      createTestFile('large.ts', largeContent);

      const files = await scanFiles({
        pattern: '*.ts',
        cwd: testDir,
        loadContent: true,
        maxFileSize: 100,
      });

      expect(files).toHaveLength(2);
      const small = files.find((f) => f.name === 'small.ts');
      const large = files.find((f) => f.name === 'large.ts');

      expect(small?.content).toBe(smallContent);
      expect(large?.content).toBeUndefined(); // Too large
    });

    it('should return correct file information', async () => {
      createTestFile('test.ts', 'content');

      const files = await scanFiles({
        pattern: '*.ts',
        cwd: testDir,
      });

      expect(files).toHaveLength(1);
      const file = files[0];

      expect(file.path).toBeTruthy();
      expect(file.relativePath).toBe('test.ts');
      expect(file.name).toBe('test.ts');
      expect(file.extension).toBe('.ts');
      expect(file.size).toBeGreaterThan(0);
    });

    it('should handle multiple patterns', async () => {
      createTestFile('file1.ts', 'content');
      createTestFile('file2.tsx', 'content');
      createTestFile('file3.js', 'content');

      const files = await scanFiles({
        pattern: ['*.ts', '*.tsx'],
        cwd: testDir,
      });

      expect(files).toHaveLength(2);
    });
  });

  describe('scanFilesGenerator', () => {
    it('should yield files one at a time', async () => {
      createTestFile('file1.ts', 'content 1');
      createTestFile('file2.ts', 'content 2');
      createTestFile('file3.ts', 'content 3');

      const files: FileInfo[] = [];
      for await (const file of scanFilesGenerator({
        pattern: '*.ts',
        cwd: testDir,
      })) {
        files.push(file);
      }

      expect(files).toHaveLength(3);
    });

    it('should load content incrementally', async () => {
      createTestFile('file1.ts', 'content 1');
      createTestFile('file2.ts', 'content 2');

      const files: FileInfo[] = [];
      for await (const file of scanFilesGenerator({
        pattern: '*.ts',
        cwd: testDir,
        loadContent: true,
      })) {
        expect(file.content).toBeTruthy();
        files.push(file);
      }

      expect(files).toHaveLength(2);
    });

    it('should respect options like scanFiles', async () => {
      createTestFile('include.ts', 'content');
      createTestFile('node_modules/exclude.ts', 'content');

      const files: FileInfo[] = [];
      for await (const file of scanFilesGenerator({
        pattern: '**/*.ts',
        cwd: testDir,
        ignore: ['**/node_modules/**'],
      })) {
        files.push(file);
      }

      expect(files).toHaveLength(1);
      expect(files[0].name).toBe('include.ts');
    });
  });

  describe('scanDirectoryRecursive', () => {
    it('should scan directory recursively', async () => {
      createTestFile('file1.ts', 'content');
      createTestFile('src/file2.ts', 'content');
      createTestFile('src/nested/file3.ts', 'content');

      const files = await scanDirectoryRecursive({
        directory: testDir,
        extensions: ['.ts'],
      });

      expect(files.length).toBeGreaterThanOrEqual(3);
    });

    it('should skip specified directories', async () => {
      createTestFile('include.ts', 'content');
      createTestFile('node_modules/exclude.ts', 'content');
      createTestFile('dist/exclude.ts', 'content');

      const files = await scanDirectoryRecursive({
        directory: testDir,
        extensions: ['.ts'],
        skipDirs: ['node_modules', 'dist'],
      });

      expect(files).toHaveLength(1);
      expect(files[0].name).toBe('include.ts');
    });

    it('should filter by extensions', async () => {
      createTestFile('file1.ts', 'content');
      createTestFile('file2.js', 'content');
      createTestFile('file3.tsx', 'content');

      const files = await scanDirectoryRecursive({
        directory: testDir,
        extensions: ['.ts', '.tsx'],
      });

      expect(files).toHaveLength(2);
      expect(files.every((f) => ['.ts', '.tsx'].includes(f.extension))).toBe(true);
    });

    it('should load content when requested', async () => {
      const content = 'test content';
      createTestFile('test.ts', content);

      const files = await scanDirectoryRecursive({
        directory: testDir,
        extensions: ['.ts'],
        loadContent: true,
      });

      expect(files).toHaveLength(1);
      expect(files[0].content).toBe(content);
    });
  });

  describe('filterByExtension', () => {
    it('should filter string paths by extension', () => {
      const paths = ['file1.ts', 'file2.js', 'file3.tsx', 'file4.css'];
      const filtered = filterByExtension(paths, ['.ts', '.tsx']);

      expect(filtered).toHaveLength(2);
      expect(filtered).toContain('file1.ts');
      expect(filtered).toContain('file3.tsx');
    });

    it('should filter FileInfo objects by extension', () => {
      const files: FileInfo[] = [
        {
          path: '/test/file1.ts',
          relativePath: 'file1.ts',
          name: 'file1.ts',
          extension: '.ts',
          size: 100,
        },
        {
          path: '/test/file2.js',
          relativePath: 'file2.js',
          name: 'file2.js',
          extension: '.js',
          size: 100,
        },
      ];

      const filtered = filterByExtension(files, ['.ts']);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('file1.ts');
    });

    it('should handle empty arrays', () => {
      const filtered = filterByExtension([], ['.ts']);
      expect(filtered).toHaveLength(0);
    });

    it('should be case-sensitive', () => {
      const paths = ['file1.TS', 'file2.ts'];
      const filtered = filterByExtension(paths, ['.ts']);

      expect(filtered).toHaveLength(1);
      expect(filtered).toContain('file2.ts');
    });
  });

  describe('filterByPattern', () => {
    it('should filter by regex pattern', () => {
      const files: FileInfo[] = [
        {
          path: '/test/component.tsx',
          relativePath: 'component.tsx',
          name: 'component.tsx',
          extension: '.tsx',
          size: 100,
        },
        {
          path: '/test/utils.ts',
          relativePath: 'utils.ts',
          name: 'utils.ts',
          extension: '.ts',
          size: 100,
        },
        {
          path: '/test/test.spec.ts',
          relativePath: 'test.spec.ts',
          name: 'test.spec.ts',
          extension: '.ts',
          size: 100,
        },
      ];

      const filtered = filterByPattern(files, /\.spec\.ts$/);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('test.spec.ts');
    });

    it('should match on relativePath', () => {
      const files: FileInfo[] = [
        {
          path: '/test/src/file.ts',
          relativePath: 'src/file.ts',
          name: 'file.ts',
          extension: '.ts',
          size: 100,
        },
        {
          path: '/test/lib/file.ts',
          relativePath: 'lib/file.ts',
          name: 'file.ts',
          extension: '.ts',
          size: 100,
        },
      ];

      const filtered = filterByPattern(files, /^src\//);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].relativePath).toBe('src/file.ts');
    });
  });

  describe('groupByDirectory', () => {
    it('should group files by directory', () => {
      const files: FileInfo[] = [
        {
          path: '/test/src/a.ts',
          relativePath: 'src/a.ts',
          name: 'a.ts',
          extension: '.ts',
          size: 100,
        },
        {
          path: '/test/src/b.ts',
          relativePath: 'src/b.ts',
          name: 'b.ts',
          extension: '.ts',
          size: 100,
        },
        {
          path: '/test/lib/c.ts',
          relativePath: 'lib/c.ts',
          name: 'c.ts',
          extension: '.ts',
          size: 100,
        },
      ];

      const grouped = groupByDirectory(files);

      expect(grouped.size).toBe(2);
      expect(grouped.get('src')).toHaveLength(2);
      expect(grouped.get('lib')).toHaveLength(1);
    });

    it('should handle files in root directory', () => {
      const files: FileInfo[] = [
        {
          path: '/test/root.ts',
          relativePath: 'root.ts',
          name: 'root.ts',
          extension: '.ts',
          size: 100,
        },
      ];

      const grouped = groupByDirectory(files);

      expect(grouped.size).toBe(1);
      expect(grouped.get('.')).toHaveLength(1);
    });

    it('should handle nested directories', () => {
      const files: FileInfo[] = [
        {
          path: '/test/src/deep/nested/file.ts',
          relativePath: 'src/deep/nested/file.ts',
          name: 'file.ts',
          extension: '.ts',
          size: 100,
        },
      ];

      const grouped = groupByDirectory(files);

      expect(grouped.size).toBe(1);
      expect(grouped.get('src/deep/nested')).toHaveLength(1);
    });
  });

  describe('edge cases', () => {
    it('should handle empty directory', async () => {
      const files = await scanFiles({
        pattern: '*.ts',
        cwd: testDir,
      });

      expect(files).toHaveLength(0);
    });

    it('should handle non-existent directory gracefully', async () => {
      const files = await scanFiles({
        pattern: '*.ts',
        cwd: join(testDir, 'nonexistent'),
      });

      expect(files).toHaveLength(0);
    });

    it('should handle files with no extension', async () => {
      createTestFile('README', 'content');
      createTestFile('LICENSE', 'content');

      const files = await scanFiles({
        pattern: '*',
        cwd: testDir,
      });

      expect(files.length).toBeGreaterThanOrEqual(2);
      const readme = files.find((f) => f.name === 'README');
      expect(readme?.extension).toBe('');
    });

    it('should handle very long file names', async () => {
      const longName = `${'a'.repeat(200)}.ts`;
      createTestFile(longName, 'content');

      const files = await scanFiles({
        pattern: '*.ts',
        cwd: testDir,
      });

      expect(files).toHaveLength(1);
      expect(files[0].name).toBe(longName);
    });

    it('should handle special characters in file names', async () => {
      const specialName = 'file-with_special.chars@123.ts';
      createTestFile(specialName, 'content');

      const files = await scanFiles({
        pattern: '*.ts',
        cwd: testDir,
      });

      expect(files).toHaveLength(1);
      expect(files[0].name).toBe(specialName);
    });
  });
});
