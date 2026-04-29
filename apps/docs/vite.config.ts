import fs from 'node:fs/promises';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** Enable verbose docs-copy plugin logging with DEBUG=docs-copy or DEBUG=* */
const DEBUG = /\b(docs-copy|\*)\b/.test(process.env.DEBUG ?? '');

/**
 * Vite plugin to copy documentation files to public directory
 * This makes markdown files accessible via HTTP during dev and in the build
 *
 * P0 Fixes:
 * - Incremental file copying (only changed files)
 * - Debounced file changes
 * - Handles file deletions
 * - Proper error logging
 * - Better path resolution
 */
// Files in docs/ that must never be served publicly.
// These are internal planning, governance, and tooling docs.
// IMPORTANT: Keep in sync with INTERNAL_FILES in scripts/copy-docs.sh
const INTERNAL_DOC_FILES = new Set([
  'MASTER_PLAN.md',
  'GOVERNANCE.md',
  'AI-AGENT-RULES.md',
  'AUTOMATION.md',
  'CI_ENVIRONMENT.md',
  'PRICE_COLLECTION.md',
  'PRODUCT_COLLECTION.md',
  'SECRETS-MANAGEMENT.md',
  'STANDARDS.md',
]);

function docsCopyPlugin() {
  const docsSource = path.resolve(import.meta.dirname, '../../docs');
  // CHIP-3 D5a: docs are served from the public root (matches flat URL layout
  // — `docs.revealui.com/admin-guide` resolves to `public/ADMIN_GUIDE.md`).
  const docsDest = path.resolve(import.meta.dirname, 'public');

  // Debounce queue
  let debounceTimer: NodeJS.Timeout | null = null;
  const pendingOperations = new Set<string>();
  const DebounceMs = 300;

  // Track if initial copy is done
  let initialCopyDone = false;

  return {
    name: 'docs-copy',
    async buildStart() {
      if (!initialCopyDone) {
        await copyAllDocsFiles();
        initialCopyDone = true;
      }
    },
    async configureServer(server) {
      // Copy all files on server start (first time only)
      if (!initialCopyDone) {
        await copyAllDocsFiles();
        initialCopyDone = true;
      }

      // Watch the docs directory
      const watchPattern = path.join(docsSource, '**/*.{md,mdx}');
      server.watcher.add(watchPattern);

      // Debounced file change handler
      const handleFileOperation = async (
        file: string,
        operation: 'change' | 'add' | 'unlink' | 'unlinkDir',
      ) => {
        // Use proper path resolution instead of string matching
        const normalizedFile = path.normalize(file);
        if (!normalizedFile.startsWith(path.normalize(docsSource))) {
          return; // Not in docs directory
        }

        // Only handle markdown files
        if (!(normalizedFile.endsWith('.md') || normalizedFile.endsWith('.mdx'))) {
          return;
        }

        // Add to pending operations
        pendingOperations.add(`${operation}:${normalizedFile}`);

        // Debounce the operation
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }

        debounceTimer = setTimeout(async () => {
          await processPendingOperations();
          debounceTimer = null;
        }, DebounceMs);
      };

      server.watcher.on('change', (file) => handleFileOperation(file, 'change'));
      server.watcher.on('add', (file) => handleFileOperation(file, 'add'));
      server.watcher.on('unlink', (file) => handleFileOperation(file, 'unlink'));
      server.watcher.on('unlinkDir', (file) => handleFileOperation(file, 'unlinkDir'));
    },
  };

  /**
   * Process all pending file operations (debounced)
   */
  async function processPendingOperations() {
    if (pendingOperations.size === 0) {
      return;
    }

    const operations = Array.from(pendingOperations);
    pendingOperations.clear();

    if (DEBUG) console.log(`[docs-copy] Processing ${operations.length} file operation(s)...`);

    for (const op of operations) {
      const [operation, file] = op.split(':', 2);

      try {
        if (operation === 'unlink' || operation === 'unlinkDir') {
          await handleFileDeletion(file);
        } else {
          await copySingleFile(file);
        }
      } catch (error) {
        console.error(
          `[docs-copy] Error processing ${operation} for ${file}:`,
          error instanceof Error ? error.message : String(error),
        );
        if (error instanceof Error && error.stack) {
          console.error(`[docs-copy] Stack trace:`, error.stack);
        }
      }
    }

    if (DEBUG) console.log('[docs-copy] File operations completed');
  }

  /**
   * Copy a single file incrementally
   */
  async function copySingleFile(filePath: string) {
    const normalizedFile = path.normalize(filePath);

    // Calculate relative path from docs source
    const relativePath = path.relative(docsSource, normalizedFile);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      console.warn(`[docs-copy] Skipping file outside docs directory: ${normalizedFile}`);
      return;
    }

    // Skip ignored directories
    const parts = relativePath.split(path.sep);
    const ignoreDirs = ['node_modules', '.next', 'dist', 'archive'];
    if (parts.some((part) => ignoreDirs.includes(part))) {
      return;
    }

    // Skip hidden files
    if (parts.some((part) => part.startsWith('.'))) {
      return;
    }

    // Skip internal-only files (only applies to top-level files)
    const filename = path.basename(normalizedFile);
    if (parts.length === 1 && INTERNAL_DOC_FILES.has(filename)) {
      return;
    }

    const destPath = path.join(docsDest, relativePath);

    try {
      // Ensure destination directory exists
      const destDir = path.dirname(destPath);
      await fs.mkdir(destDir, { recursive: true });

      // Copy the file
      await fs.copyFile(normalizedFile, destPath);
      if (DEBUG) console.log(`[docs-copy] ✓ Copied: ${relativePath}`);
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        console.warn(`[docs-copy] Source file not found: ${normalizedFile}`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Handle file deletion - remove from public directory
   */
  async function handleFileDeletion(filePath: string) {
    const normalizedFile = path.normalize(filePath);

    // Calculate relative path
    const relativePath = path.relative(docsSource, normalizedFile);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      return; // Not in docs directory
    }

    const destPath = path.join(docsDest, relativePath);

    try {
      // Check if file exists in destination
      await fs.access(destPath);

      // Delete the file
      await fs.unlink(destPath);
      if (DEBUG) console.log(`[docs-copy] ✗ Deleted: ${relativePath}`);

      // Clean up empty directories
      let currentDir = path.dirname(destPath);
      while (currentDir !== docsDest && currentDir.length > docsDest.length) {
        try {
          const entries = await fs.readdir(currentDir);
          if (entries.length === 0) {
            await fs.rmdir(currentDir);
            if (DEBUG)
              console.log(
                `[docs-copy] ✗ Removed empty directory: ${path.relative(docsDest, currentDir)}`,
              );
            currentDir = path.dirname(currentDir);
          } else {
            break;
          }
        } catch {
          break;
        }
      }
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        // File already doesn't exist, that's fine
        return;
      } else {
        throw error;
      }
    }
  }

  /**
   * Copy all docs files (used for initial copy and build)
   */
  async function copyAllDocsFiles() {
    try {
      // Ensure destination directory exists
      await fs.mkdir(docsDest, { recursive: true });

      // Copy entire docs directory structure (excluding archives)
      await copyDirectory(docsSource, docsDest, [
        'node_modules',
        '.next',
        'dist',
        'archive', // Skip archive in public - too large
      ]);

      if (DEBUG)
        console.log(
          '[docs-copy] ✓ Initial copy completed: All documentation files copied to public directory',
        );
    } catch (error) {
      console.error('[docs-copy] ✗ Failed to copy docs files:', error);
      if (error instanceof Error && error.stack) {
        console.error('[docs-copy] Stack trace:', error.stack);
      }
      throw error;
    }
  }

  /**
   * Recursively copy directory structure
   */
  async function copyDirectory(src: string, dest: string, ignore: string[] = []) {
    try {
      const entries = await fs.readdir(src, { withFileTypes: true });

      for (const entry of entries) {
        // Skip ignored directories and hidden files
        if (ignore.includes(entry.name) || entry.name.startsWith('.')) {
          continue;
        }

        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
          await fs.mkdir(destPath, { recursive: true });
          await copyDirectory(srcPath, destPath, ignore);
        } else if (entry.isFile()) {
          // Copy all markdown files, but skip internal-only top-level files
          if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) {
            // Only filter at the top level (src === docsSource)
            if (src === docsSource && INTERNAL_DOC_FILES.has(entry.name)) {
              continue;
            }
            await fs.copyFile(srcPath, destPath);
          }
        }
      }
    } catch (error) {
      // Ignore errors for missing directories
      const err = error as NodeJS.ErrnoException;
      if (err.code !== 'ENOENT') {
        console.warn(`[docs-copy] Failed to copy ${src}:`, err.message);
      }
    }
  }
}

export default defineConfig({
  plugins: [tailwindcss(), react(), docsCopyPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './app'),
    },
  },
  server: {
    port: 3002,
    open: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  publicDir: 'public',
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
    'process.env.LOG_LEVEL': JSON.stringify(process.env.LOG_LEVEL ?? 'warn'),
  },
});
