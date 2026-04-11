/**
 * file_write  -  Write entire file contents
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { z } from 'zod/v4';
import type { Tool, ToolResult } from '../base.js';
import { getSafetyConfig, resolveSafePath, validatePath } from './safety.js';

export const fileWriteTool: Tool = {
  name: 'file_write',
  label: 'Write File',
  description:
    'Write content to a file, creating it if it does not exist. Overwrites existing content. Use file_edit for surgical changes to existing files.',
  parameters: z.object({
    path: z.string().describe('File path relative to project root'),
    content: z.string().describe('The full content to write'),
    createDirs: z
      .boolean()
      .optional()
      .describe('Create parent directories if they do not exist (default: true)'),
  }),

  async execute(params): Promise<ToolResult> {
    const { path, content, createDirs } = params as {
      path: string;
      content: string;
      createDirs?: boolean;
    };
    const config = getSafetyConfig();
    const check = validatePath(path, config);
    if (!check.safe) {
      return { success: false, error: check.reason };
    }

    const resolvedPath = resolveSafePath(path, config);

    try {
      if (createDirs !== false) {
        mkdirSync(dirname(resolvedPath), { recursive: true });
      }

      // Normalize to trailing newline
      const normalized = content.endsWith('\n') ? content : `${content}\n`;
      writeFileSync(resolvedPath, normalized, 'utf8');

      const lineCount = normalized.split('\n').length - 1;
      return {
        success: true,
        data: { path, bytes: Buffer.byteLength(normalized), lines: lineCount },
        content: `Wrote ${lineCount} lines to ${path}`,
      };
    } catch (err) {
      return {
        success: false,
        error: `Failed to write ${path}: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};
