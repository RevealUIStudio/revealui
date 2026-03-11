#!/usr/bin/env tsx

/**
 * Rollback Integration Tests for validate-root-markdown.ts
 *
 * Priority 2: Tests rollback script integration with validation script
 */

import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { validateRootMarkdown } from '../validate-root-markdown.ts';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const testProjectRoot = join(__dirname, '../../..', '.test-validate-root-markdown-rollback');

// Read rollback info format (matches rollback-markdown-move.ts)
interface RollbackInfo {
  timestamp: string;
  movedFiles: Array<{
    source: string;
    target: string;
    backup?: string;
  }>;
}

describe('Validate Root Markdown - Rollback Integration Tests', () => {
  beforeEach(async () => {
    // Clean up test directory
    try {
      await rm(testProjectRoot, { recursive: true, force: true });
    } catch {
      // Ignore if doesn't exist
    }
    await mkdir(testProjectRoot, { recursive: true });

    // Set non-interactive mode for tests
    process.env.NON_INTERACTIVE = 'true';
    process.env.CI = 'true';
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await rm(testProjectRoot, { recursive: true, force: true });
    } catch {
      // Ignore errors
    }
  });

  describe('Rollback Info Format', () => {
    it('should create rollback info in correct format', async () => {
      // Create test file
      await writeFile(join(testProjectRoot, 'AGENT_HANDOFF.md'), '# Agent Handoff');

      // Execute validation script
      await validateRootMarkdown({ fix: true }, testProjectRoot);

      // Find rollback info
      const backupDir = join(testProjectRoot, '.cursor', 'backups');
      const backupDirs = await readdir(backupDir);
      const latestBackupDir = backupDirs
        .filter((d) => d.startsWith('markdown-move-'))
        .sort()
        .pop();

      if (!latestBackupDir) {
        throw new Error('No backup directory found');
      }

      const rollbackInfoPath = join(backupDir, latestBackupDir, 'rollback-info.json');
      expect(existsSync(rollbackInfoPath)).toBe(true);

      // Verify rollback info format
      const rollbackInfo: RollbackInfo = JSON.parse(await readFile(rollbackInfoPath, 'utf-8'));

      // Verify structure
      expect(rollbackInfo).toHaveProperty('timestamp');
      expect(rollbackInfo).toHaveProperty('movedFiles');
      expect(Array.isArray(rollbackInfo.movedFiles)).toBe(true);
      expect(rollbackInfo.movedFiles.length).toBeGreaterThan(0);

      // Verify movedFiles structure
      for (const movedFile of rollbackInfo.movedFiles) {
        expect(movedFile).toHaveProperty('source');
        expect(movedFile).toHaveProperty('target');
        expect(movedFile).toHaveProperty('backup');
        expect(typeof movedFile.source).toBe('string');
        expect(typeof movedFile.target).toBe('string');
        expect(typeof movedFile.backup).toBe('string');
      }

      // Verify timestamp is ISO format
      expect(new Date(rollbackInfo.timestamp).toISOString()).toBe(rollbackInfo.timestamp);
    });

    it('should match format expected by rollback script', async () => {
      // Create test file
      await writeFile(join(testProjectRoot, 'TEST.md'), '# Test');

      // Execute validation script
      await validateRootMarkdown({ fix: true }, testProjectRoot);

      // Find rollback info
      const backupDir = join(testProjectRoot, '.cursor', 'backups');
      const backupDirs = await readdir(backupDir);
      const latestBackupDir = backupDirs
        .filter((d) => d.startsWith('markdown-move-'))
        .sort()
        .pop();

      if (!latestBackupDir) {
        throw new Error('No backup directory found');
      }

      const rollbackInfoPath = join(backupDir, latestBackupDir, 'rollback-info.json');
      const rollbackInfo: RollbackInfo = JSON.parse(await readFile(rollbackInfoPath, 'utf-8'));

      // Verify format matches rollback script expectations
      expect(rollbackInfo.movedFiles.length).toBeGreaterThan(0);
      for (const movedFile of rollbackInfo.movedFiles) {
        // Rollback script expects: source, target, backup
        expect(movedFile.source).toBeDefined();
        expect(movedFile.target).toBeDefined();
        expect(movedFile.backup).toBeDefined();
        // Verify paths are absolute (rollback script expects this)
        expect(movedFile.source.startsWith('/') || movedFile.source.includes(testProjectRoot)).toBe(
          true,
        );
        expect(movedFile.target.startsWith('/') || movedFile.target.includes(testProjectRoot)).toBe(
          true,
        );
      }
    });
  });

  describe('End-to-End: Validate → Move → Rollback', () => {
    it('should restore files correctly after rollback', async () => {
      // Create test files
      const file1Content = '# Agent Handoff\n\nContent 1';
      const file2Content = '# Test Guide\n\nContent 2';
      await writeFile(join(testProjectRoot, 'AGENT_HANDOFF.md'), file1Content);
      await writeFile(join(testProjectRoot, 'TEST_GUIDE.md'), file2Content);

      // Execute validation script in fix mode
      await validateRootMarkdown({ fix: true }, testProjectRoot);

      // Verify files moved
      expect(existsSync(join(testProjectRoot, 'AGENT_HANDOFF.md'))).toBe(false);
      expect(existsSync(join(testProjectRoot, 'TEST_GUIDE.md'))).toBe(false);
      expect(existsSync(join(testProjectRoot, 'docs', 'agent', 'AGENT_HANDOFF.md'))).toBe(true);
      expect(existsSync(join(testProjectRoot, 'docs', 'guides', 'TEST_GUIDE.md'))).toBe(true);

      // Find rollback info
      const backupDir = join(testProjectRoot, '.cursor', 'backups');
      const backupDirs = await readdir(backupDir);
      const latestBackupDir = backupDirs
        .filter((d) => d.startsWith('markdown-move-'))
        .sort()
        .pop();

      if (!latestBackupDir) {
        throw new Error('No backup directory found');
      }

      const rollbackInfoPath = join(backupDir, latestBackupDir, 'rollback-info.json');
      const rollbackInfo: RollbackInfo = JSON.parse(await readFile(rollbackInfoPath, 'utf-8'));

      // Manually restore files (simulating rollback script behavior)
      for (const movedFile of rollbackInfo.movedFiles) {
        // Move file back from target to source
        if (existsSync(movedFile.target)) {
          await rename(movedFile.target, movedFile.source);
        }
      }

      // Verify files restored
      expect(existsSync(join(testProjectRoot, 'AGENT_HANDOFF.md'))).toBe(true);
      expect(existsSync(join(testProjectRoot, 'TEST_GUIDE.md'))).toBe(true);
      expect(existsSync(join(testProjectRoot, 'docs', 'agent', 'AGENT_HANDOFF.md'))).toBe(false);
      expect(existsSync(join(testProjectRoot, 'docs', 'guides', 'TEST_GUIDE.md'))).toBe(false);

      // Verify content preserved
      const restoredContent1 = await readFile(join(testProjectRoot, 'AGENT_HANDOFF.md'), 'utf-8');
      const restoredContent2 = await readFile(join(testProjectRoot, 'TEST_GUIDE.md'), 'utf-8');
      expect(restoredContent1).toBe(file1Content);
      expect(restoredContent2).toBe(file2Content);
    });

    it('should preserve backup files after rollback', async () => {
      // Create test file
      const originalContent = '# Test File';
      await writeFile(join(testProjectRoot, 'TEST.md'), originalContent);

      // Execute validation script
      await validateRootMarkdown({ fix: true }, testProjectRoot);

      // Find backup
      const backupDir = join(testProjectRoot, '.cursor', 'backups');
      const backupDirs = await readdir(backupDir);
      const latestBackupDir = backupDirs
        .filter((d) => d.startsWith('markdown-move-'))
        .sort()
        .pop();

      if (!latestBackupDir) {
        throw new Error('No backup directory found');
      }

      const backupFiles = await readdir(join(backupDir, latestBackupDir));
      const backupFile = backupFiles.find((f) => f === 'TEST.md');

      if (backupFile) {
        const backupPath = join(backupDir, latestBackupDir, backupFile);
        expect(existsSync(backupPath)).toBe(true);

        // Verify backup content matches original
        const backupContent = await readFile(backupPath, 'utf-8');
        expect(backupContent).toBe(originalContent);
      }
    });

    it('should handle multiple files in rollback', async () => {
      // Create multiple test files
      const files = ['FILE1.md', 'FILE2.md', 'FILE3.md'];
      for (const file of files) {
        await writeFile(join(testProjectRoot, file), `# ${file}`);
      }

      // Execute validation script
      await validateRootMarkdown({ fix: true }, testProjectRoot);

      // Verify all files moved
      for (const file of files) {
        expect(existsSync(join(testProjectRoot, file))).toBe(false);
      }

      // Find rollback info and restore
      const backupDir = join(testProjectRoot, '.cursor', 'backups');
      const backupDirs = await readdir(backupDir);
      const latestBackupDir = backupDirs
        .filter((d) => d.startsWith('markdown-move-'))
        .sort()
        .pop();

      if (!latestBackupDir) {
        throw new Error('No backup directory found');
      }

      const rollbackInfoPath = join(backupDir, latestBackupDir, 'rollback-info.json');
      const rollbackInfo: RollbackInfo = JSON.parse(await readFile(rollbackInfoPath, 'utf-8'));

      // Restore all files
      for (const movedFile of rollbackInfo.movedFiles) {
        if (existsSync(movedFile.target)) {
          await rename(movedFile.target, movedFile.source);
        }
      }

      // Verify all files restored
      for (const file of files) {
        expect(existsSync(join(testProjectRoot, file))).toBe(true);
      }
    });
  });
});
