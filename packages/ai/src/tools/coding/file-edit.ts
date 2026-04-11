/**
 * file_edit  -  Surgical string replacement in a file
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod/v4';
import type { Tool, ToolResult } from '../base.js';
import { getSafetyConfig, resolveSafePath, validatePath } from './safety.js';

export const fileEditTool: Tool = {
  name: 'file_edit',
  label: 'Edit File',
  description:
    'Replace an exact string in a file. The old_text must appear exactly once in the file. For creating new files or full rewrites, use file_write instead.',
  parameters: z.object({
    path: z.string().describe('File path relative to project root'),
    old_text: z
      .string()
      .describe('The exact text to find and replace (must be unique in the file)'),
    new_text: z.string().describe('The replacement text'),
  }),

  async execute(params): Promise<ToolResult> {
    const { path, old_text, new_text } = params as {
      path: string;
      old_text: string;
      new_text: string;
    };
    const config = getSafetyConfig();
    const check = validatePath(path, config);
    if (!check.safe) {
      return { success: false, error: check.reason };
    }

    if (old_text === new_text) {
      return { success: false, error: 'old_text and new_text are identical  -  nothing to change' };
    }

    const resolvedPath = resolveSafePath(path, config);

    try {
      const content = readFileSync(resolvedPath, 'utf8');

      // Count occurrences
      let count = 0;
      let idx = 0;
      while (idx < content.length) {
        const found = content.indexOf(old_text, idx);
        if (found === -1) break;
        count++;
        idx = found + old_text.length;
      }

      if (count === 0) {
        return {
          success: false,
          error: `old_text not found in ${path}. Verify the exact text including whitespace.`,
        };
      }
      if (count > 1) {
        return {
          success: false,
          error: `old_text found ${count} times in ${path}. Provide more surrounding context to make it unique.`,
        };
      }

      const updated = content.replace(old_text, new_text);
      writeFileSync(resolvedPath, updated, 'utf8');

      const addedLines = new_text.split('\n').length - old_text.split('\n').length;
      const sign = addedLines >= 0 ? '+' : '';
      return {
        success: true,
        data: { path, addedLines },
        content: `Edited ${path} (${sign}${addedLines} lines)`,
      };
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') return { success: false, error: `File not found: ${path}` };
      return {
        success: false,
        error: `Failed to edit ${path}: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};
