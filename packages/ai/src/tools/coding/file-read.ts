/**
 * file_read  -  Read file contents with line numbers
 */

import { readFileSync } from 'node:fs';
import { z } from 'zod/v4';
import type { Tool, ToolResult } from '../base.js';
import { getSafetyConfig, resolveSafePath, validatePath } from './safety.js';

export const fileReadTool: Tool = {
  name: 'file_read',
  label: 'Read File',
  description:
    'Read the contents of a file. Returns line-numbered output. Use offset/limit to read specific sections of large files.',
  parameters: z.object({
    path: z.string().describe('File path relative to project root'),
    offset: z.number().optional().describe('Start reading from this line number (1-based)'),
    limit: z.number().optional().describe('Maximum number of lines to read (default: 2000)'),
  }),

  async execute(params): Promise<ToolResult> {
    const { path, offset, limit } = params as { path: string; offset?: number; limit?: number };
    const config = getSafetyConfig();
    const check = validatePath(path, config);
    if (!check.safe) {
      return { success: false, error: check.reason };
    }

    const resolvedPath = resolveSafePath(path, config);
    const maxLines = limit ?? 2000;
    const startLine = (offset ?? 1) - 1; // Convert to 0-based

    try {
      // Read first, then check if directory (avoids TOCTOU race between stat and read)
      let raw: string;
      try {
        raw = readFileSync(resolvedPath, 'utf8');
      } catch (readErr) {
        if ((readErr as NodeJS.ErrnoException).code === 'EISDIR') {
          return {
            success: false,
            error: `${path} is a directory, not a file. Use file_glob to list directory contents.`,
          };
        }
        throw readErr;
      }
      const allLines = raw.split('\n');
      const totalLines = allLines.length;
      const sliced = allLines.slice(startLine, startLine + maxLines);
      const numbered = sliced
        .map((line, i) => `${String(startLine + i + 1).padStart(6)}  ${line}`)
        .join('\n');

      const truncated = sliced.length < totalLines - startLine;
      const summary = truncated
        ? `${path} (lines ${startLine + 1}-${startLine + sliced.length} of ${totalLines})`
        : `${path} (${totalLines} lines)`;

      return {
        success: true,
        data: {
          path,
          totalLines,
          startLine: startLine + 1,
          linesReturned: sliced.length,
          content: numbered,
        },
        content: `${summary}\n${numbered}`,
      };
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') return { success: false, error: `File not found: ${path}` };
      if (code === 'EACCES') return { success: false, error: `Permission denied: ${path}` };
      return {
        success: false,
        error: `Failed to read ${path}: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};
