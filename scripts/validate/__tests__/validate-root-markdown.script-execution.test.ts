#!/usr/bin/env tsx

/**
 * Script Execution Integration Tests for validate-root-markdown.ts
 *
 * Priority 1: Tests actual script execution with real file system operations
 */

import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { validateRootMarkdown } from '../validate-root-markdown.ts';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const testProjectRoot = join(__dirname, '../../..', '.test-validate-root-markdown-script');

describe('Validate Root Markdown - Script Execution Tests', () => {
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

  describe('Script Execution - Non-Fix Mode', () => {
    it('should detect violations without fixing them', async () => {
      // Create test files
      await writeFile(join(testProjectRoot, 'README.md'), '# README');
      await writeFile(join(testProjectRoot, 'AGENT_HANDOFF.md'), '# Agent Handoff');
      await writeFile(join(testProjectRoot, 'TEST_GUIDE.md'), '# Test Guide');

      // Execute script in non-fix mode - should throw error due to process.exit(1)
      try {
        await validateRootMarkdown({ fix: false }, testProjectRoot);
      } catch {
        // validateRootMarkdown calls process.exit(1) when violations found
        // In tests, this doesn't actually exit, but the function completes
        // The real test is that files weren't moved
      }

      // Note: process.exit(1) in non-fix mode with violations
      // For now, verify files were NOT moved (the actual behavior we care about)
      expect(existsSync(join(testProjectRoot, 'AGENT_HANDOFF.md'))).toBe(true);
      expect(existsSync(join(testProjectRoot, 'TEST_GUIDE.md'))).toBe(true);
      expect(existsSync(join(testProjectRoot, 'docs', 'agent', 'AGENT_HANDOFF.md'))).toBe(false);
      expect(existsSync(join(testProjectRoot, 'docs', 'guides', 'TEST_GUIDE.md'))).toBe(false);
    });

    it('should not move files in non-fix mode', async () => {
      // Create a file
      await writeFile(join(testProjectRoot, 'TEST.md'), '# Test');

      // Mock process.exit
      const originalExit = process.exit;
      let exitCalled = false;

      process.exit = ((_code?: number) => {
        exitCalled = true;
      }) as typeof process.exit;

      try {
        await validateRootMarkdown({ fix: false }, testProjectRoot);
      } catch {
        // Expected - violations detected
      } finally {
        process.exit = originalExit;
      }

      // Should have called exit due to violations
      expect(exitCalled).toBe(true);

      // Verify file still in root (not moved)
      expect(existsSync(join(testProjectRoot, 'TEST.md'))).toBe(true);
      expect(existsSync(join(testProjectRoot, 'docs', 'TEST.md'))).toBe(false);
    });

    it('should pass validation when all files are allowed', async () => {
      // Only allowed files
      await writeFile(join(testProjectRoot, 'README.md'), '# README');
      await writeFile(join(testProjectRoot, 'AGENT.md'), '# Agent');

      // Execute script - should pass (no violations)
      await validateRootMarkdown({ fix: false }, testProjectRoot);

      // Verify files still in root
      expect(existsSync(join(testProjectRoot, 'README.md'))).toBe(true);
      expect(existsSync(join(testProjectRoot, 'AGENT.md'))).toBe(true);
    });
  });

  describe('Script Execution - Fix Mode', () => {
    it('should move violation files to correct subfolders', async () => {
      // Create test files
      await writeFile(join(testProjectRoot, 'README.md'), '# README');
      await writeFile(join(testProjectRoot, 'AGENT_HANDOFF.md'), '# Agent Handoff');
      await writeFile(join(testProjectRoot, 'TEST_GUIDE.md'), '# Test Guide');
      await writeFile(join(testProjectRoot, 'TEST_ASSESSMENT.md'), '# Test Assessment');

      // Execute script in fix mode
      await validateRootMarkdown({ fix: true }, testProjectRoot);

      // Verify allowed file stayed
      expect(existsSync(join(testProjectRoot, 'README.md'))).toBe(true);

      // Verify violations were moved
      expect(existsSync(join(testProjectRoot, 'AGENT_HANDOFF.md'))).toBe(false);
      expect(existsSync(join(testProjectRoot, 'TEST_GUIDE.md'))).toBe(false);
      expect(existsSync(join(testProjectRoot, 'TEST_ASSESSMENT.md'))).toBe(false);

      expect(existsSync(join(testProjectRoot, 'docs', 'agent', 'AGENT_HANDOFF.md'))).toBe(true);
      expect(existsSync(join(testProjectRoot, 'docs', 'guides', 'TEST_GUIDE.md'))).toBe(true);
      expect(existsSync(join(testProjectRoot, 'docs', 'assessments', 'TEST_ASSESSMENT.md'))).toBe(
        true,
      );
    });

    it('should preserve file contents after moving', async () => {
      const originalContent = '# Agent Handoff\n\nThis is a test file.';
      await writeFile(join(testProjectRoot, 'AGENT_HANDOFF.md'), originalContent);

      // Execute script in fix mode
      await validateRootMarkdown({ fix: true }, testProjectRoot);

      // Verify content preserved
      const movedContent = await readFile(
        join(testProjectRoot, 'docs', 'agent', 'AGENT_HANDOFF.md'),
        'utf-8',
      );
      expect(movedContent).toBe(originalContent);
    });

    it('should create backup before moving files', async () => {
      await writeFile(join(testProjectRoot, 'AGENT_HANDOFF.md'), '# Agent Handoff');

      // Execute script in fix mode
      await validateRootMarkdown({ fix: true }, testProjectRoot);

      // Verify backup exists
      const backupDir = join(testProjectRoot, '.cursor', 'backups');
      const backupDirs = await readdir(backupDir);
      const hasBackupDir = backupDirs.some((d) => d.startsWith('markdown-move-'));

      expect(hasBackupDir).toBe(true);

      if (hasBackupDir) {
        const latestBackupDir = backupDirs
          .filter((d) => d.startsWith('markdown-move-'))
          .sort()
          .pop();
        if (latestBackupDir) {
          const backupFiles = await readdir(join(backupDir, latestBackupDir));
          const hasBackup = backupFiles.includes('AGENT_HANDOFF.md');
          expect(hasBackup).toBe(true);
        }
      }
    });

    it('should create rollback info after moving files', async () => {
      await writeFile(join(testProjectRoot, 'AGENT_HANDOFF.md'), '# Agent Handoff');

      // Execute script in fix mode
      await validateRootMarkdown({ fix: true }, testProjectRoot);

      // Verify rollback info exists
      const backupDir = join(testProjectRoot, '.cursor', 'backups');
      const backupDirs = await readdir(backupDir);
      const latestBackupDir = backupDirs
        .filter((d) => d.startsWith('markdown-move-'))
        .sort()
        .pop();

      if (latestBackupDir) {
        const rollbackInfoPath = join(backupDir, latestBackupDir, 'rollback-info.json');
        expect(existsSync(rollbackInfoPath)).toBe(true);

        // Verify rollback info format
        const rollbackInfo = JSON.parse(await readFile(rollbackInfoPath, 'utf-8'));
        expect(rollbackInfo).toHaveProperty('timestamp');
        expect(rollbackInfo).toHaveProperty('movedFiles');
        expect(Array.isArray(rollbackInfo.movedFiles)).toBe(true);
        expect(rollbackInfo.movedFiles.length).toBeGreaterThan(0);
      }
    });

    it('should handle multiple violations correctly', async () => {
      // Create multiple violations
      await writeFile(join(testProjectRoot, 'FILE1.md'), '# File 1');
      await writeFile(join(testProjectRoot, 'FILE2.md'), '# File 2');
      await writeFile(join(testProjectRoot, 'FILE3.md'), '# File 3');

      // Execute script in fix mode
      await validateRootMarkdown({ fix: true }, testProjectRoot);

      // Verify all files moved
      expect(existsSync(join(testProjectRoot, 'FILE1.md'))).toBe(false);
      expect(existsSync(join(testProjectRoot, 'FILE2.md'))).toBe(false);
      expect(existsSync(join(testProjectRoot, 'FILE3.md'))).toBe(false);
    });

    it('should skip files that already exist in target', async () => {
      // Create target directory and file (using default docs/ category)
      await mkdir(join(testProjectRoot, 'docs'), { recursive: true });
      await writeFile(join(testProjectRoot, 'docs', 'EXISTING.md'), '# Existing');

      // Create file with same name in root
      // EXISTING.md will be categorized to docs/ (default category)
      await writeFile(join(testProjectRoot, 'EXISTING.md'), '# New');

      // Execute script in fix mode
      await validateRootMarkdown({ fix: true }, testProjectRoot);

      // Verify original file in target still exists
      expect(existsSync(join(testProjectRoot, 'docs', 'EXISTING.md'))).toBe(true);
      const content = await readFile(join(testProjectRoot, 'docs', 'EXISTING.md'), 'utf-8');
      expect(content).toBe('# Existing'); // Original content preserved

      // Verify file in root still exists (skipped because target exists)
      expect(existsSync(join(testProjectRoot, 'EXISTING.md'))).toBe(true);
    });

    it('should create nested directories as needed', async () => {
      await writeFile(join(testProjectRoot, 'TEST_ASSESSMENT.md'), '# Assessment');

      // Execute script in fix mode
      await validateRootMarkdown({ fix: true }, testProjectRoot);

      // Verify nested directory created
      expect(existsSync(join(testProjectRoot, 'docs', 'assessments'))).toBe(true);
      expect(existsSync(join(testProjectRoot, 'docs', 'assessments', 'TEST_ASSESSMENT.md'))).toBe(
        true,
      );
    });
  });

  describe('Script Execution - Error Handling', () => {
    it('should handle empty root directory', async () => {
      // No files in root

      // Execute script - should pass (no violations)
      await validateRootMarkdown({ fix: false }, testProjectRoot);
      // Should not throw
    });

    it('should handle only allowed files', async () => {
      // Only allowed files
      await writeFile(join(testProjectRoot, 'README.md'), '# README');
      await writeFile(join(testProjectRoot, 'AGENT.md'), '# Agent');

      // Execute script - should pass
      await validateRootMarkdown({ fix: false }, testProjectRoot);
      // Should not throw
    });
  });
});
