/**
 * file_glob  -  Fast file pattern matching with picomatch-style globs
 */

import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { z } from 'zod/v4';
import type { Tool, ToolResult } from '../base.js';
import { getSafetyConfig } from './safety.js';

/** Simple glob matcher supporting *, **, and ? */
function matchGlob(pattern: string, filePath: string): boolean {
  const regex = pattern
    .replace(/\\/g, '\\\\')
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '⟨GLOBSTAR⟩')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/⟨GLOBSTAR⟩/g, '.*');
  return new RegExp(`^${regex}$`).test(filePath);
}

/** Recursively walk a directory, yielding relative paths */
function walkDir(dir: string, root: string, maxFiles: number): string[] {
  const results: string[] = [];

  function recurse(current: string): void {
    if (results.length >= maxFiles) return;

    let entries: string[];
    try {
      entries = readdirSync(current);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= maxFiles) return;

      // Skip common non-useful directories
      if (
        entry === 'node_modules' ||
        entry === '.git' ||
        entry === 'dist' ||
        entry === '.turbo' ||
        entry === '.next' ||
        entry === 'coverage'
      ) {
        continue;
      }

      const fullPath = join(current, entry);
      let stat: ReturnType<typeof statSync> | undefined;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        recurse(fullPath);
      } else {
        results.push(relative(root, fullPath));
      }
    }
  }

  recurse(dir);
  return results;
}

export const fileGlobTool: Tool = {
  name: 'file_glob',
  label: 'Find Files',
  description:
    'Find files matching a glob pattern. Supports *, **, and ? wildcards. Results sorted by modification time (newest first). Skips node_modules, .git, dist, .turbo.',
  parameters: z.object({
    pattern: z.string().describe('Glob pattern (e.g., "**/*.ts", "src/**/*.test.ts")'),
    path: z
      .string()
      .optional()
      .describe('Directory to search in, relative to project root (default: project root)'),
  }),

  async execute(params): Promise<ToolResult> {
    const { pattern, path } = params as { pattern: string; path?: string };
    const config = getSafetyConfig();
    const maxFiles = 10_000;

    const searchRoot = path ? join(config.projectRoot, path) : config.projectRoot;

    try {
      const stat = statSync(searchRoot);
      if (!stat.isDirectory()) {
        return { success: false, error: `Not a directory: ${path ?? '.'}` };
      }
    } catch {
      return { success: false, error: `Directory not found: ${path ?? '.'}` };
    }

    try {
      const allFiles = walkDir(searchRoot, config.projectRoot, maxFiles);

      // Filter by glob pattern
      const matched = allFiles.filter((f) => matchGlob(pattern, f));

      // Sort by mtime (newest first)
      const withMtime = matched.map((f) => {
        try {
          const s = statSync(join(config.projectRoot, f));
          return { path: f, mtime: s.mtimeMs };
        } catch {
          return { path: f, mtime: 0 };
        }
      });
      withMtime.sort((a, b) => b.mtime - a.mtime);

      const paths = withMtime.map((f) => f.path);
      const truncated = paths.length > 200;
      const display = truncated ? paths.slice(0, 200) : paths;

      return {
        success: true,
        data: { pattern, totalMatches: paths.length, files: display },
        content: truncated
          ? `Found ${paths.length} files matching "${pattern}" (showing first 200):\n${display.join('\n')}`
          : `Found ${paths.length} files matching "${pattern}":\n${display.join('\n')}`,
      };
    } catch (err) {
      return {
        success: false,
        error: `Glob failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};
