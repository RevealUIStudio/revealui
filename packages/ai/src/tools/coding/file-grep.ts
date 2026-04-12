/**
 * file_grep — Regex content search across files
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { z } from 'zod/v4';
import type { Tool, ToolResult } from '../base.js';
import { getSafetyConfig } from './safety.js';

interface GrepMatch {
  file: string;
  line: number;
  content: string;
}

/** Simple glob test for file filtering */
function matchesGlob(filePath: string, glob: string): boolean {
  const regex = glob
    .replace(/\\/g, '\\\\')
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '⟨GLOBSTAR⟩')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/⟨GLOBSTAR⟩/g, '.*');
  return new RegExp(`^${regex}$`).test(filePath);
}

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  '.turbo',
  '.next',
  'coverage',
  '.vercel',
]);

const BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.ico',
  '.webp',
  '.svg',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.mp3',
  '.mp4',
  '.zip',
  '.tar',
  '.gz',
  '.pdf',
  '.lock',
]);

function isBinary(path: string): boolean {
  const ext = path.slice(path.lastIndexOf('.'));
  return BINARY_EXTENSIONS.has(ext);
}

/** Recursively collect file paths */
function collectFiles(dir: string, root: string, glob?: string, maxFiles = 50_000): string[] {
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
      if (SKIP_DIRS.has(entry)) continue;

      const fullPath = join(current, entry);
      let stat: ReturnType<typeof statSync> | undefined;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        recurse(fullPath);
      } else if (!isBinary(fullPath)) {
        const rel = relative(root, fullPath);
        if (!glob || matchesGlob(rel, glob)) {
          results.push(fullPath);
        }
      }
    }
  }

  recurse(dir);
  return results;
}

export const fileGrepTool: Tool = {
  name: 'file_grep',
  label: 'Search Code',
  description:
    'Search file contents with regex. Returns matching lines with context. Use glob to filter by file pattern. Skips binary files and node_modules.',
  parameters: z.object({
    pattern: z.string().describe('Regex pattern to search for'),
    path: z
      .string()
      .optional()
      .describe('Directory to search in, relative to project root (default: project root)'),
    glob: z.string().optional().describe('File glob to filter (e.g., "**/*.ts", "*.json")'),
    contextLines: z
      .number()
      .optional()
      .describe('Lines of context before/after each match (default: 0)'),
  }),

  async execute(params): Promise<ToolResult> {
    const {
      pattern,
      path,
      glob,
      contextLines = 0,
    } = params as {
      pattern: string;
      path?: string;
      glob?: string;
      contextLines?: number;
    };
    const config = getSafetyConfig();
    const maxMatches = 500;
    const searchRoot = path ? join(config.projectRoot, path) : config.projectRoot;

    let regex: RegExp;
    try {
      regex = new RegExp(pattern, 'g');
    } catch (err) {
      return {
        success: false,
        error: `Invalid regex: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    try {
      const files = collectFiles(searchRoot, config.projectRoot, glob);
      const matches: GrepMatch[] = [];
      let filesSearched = 0;
      let filesWithMatches = 0;

      for (const filePath of files) {
        if (matches.length >= maxMatches) break;

        let content: string;
        try {
          content = readFileSync(filePath, 'utf8');
        } catch {
          continue;
        }
        filesSearched++;

        const lines = content.split('\n');
        let fileHasMatch = false;

        for (let i = 0; i < lines.length; i++) {
          if (matches.length >= maxMatches) break;

          regex.lastIndex = 0;
          const currentLine = lines[i];
          if (currentLine !== undefined && regex.test(currentLine)) {
            if (!fileHasMatch) {
              fileHasMatch = true;
              filesWithMatches++;
            }

            const rel = relative(config.projectRoot, filePath);
            if (contextLines > 0) {
              const start = Math.max(0, i - contextLines);
              const end = Math.min(lines.length - 1, i + contextLines);
              const ctx = lines
                .slice(start, end + 1)
                .map((l, idx) => {
                  const lineNum = start + idx + 1;
                  const marker = start + idx === i ? '>' : ' ';
                  return `${marker}${String(lineNum).padStart(6)} ${l}`;
                })
                .join('\n');
              matches.push({ file: rel, line: i + 1, content: ctx });
            } else {
              matches.push({
                file: rel,
                line: i + 1,
                content: currentLine.trim(),
              });
            }
          }
        }
      }

      const truncated = matches.length >= maxMatches;
      const summary = `${filesWithMatches} files, ${matches.length} matches${truncated ? ' (truncated)' : ''} across ${filesSearched} files searched`;

      const display = matches
        .map((m) =>
          contextLines > 0
            ? `${m.file}:${m.line}\n${m.content}`
            : `${m.file}:${m.line}: ${m.content}`,
        )
        .join('\n');

      return {
        success: true,
        data: { pattern, filesSearched, filesWithMatches, matchCount: matches.length, matches },
        content: `${summary}\n${display}`,
      };
    } catch (err) {
      return {
        success: false,
        error: `Grep failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};
