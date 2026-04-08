import { beforeEach, describe, expect, it } from 'vitest';
import type { ModelTier } from '../context-budget.js';
import {
  compressSearchResult,
  compressToolResult,
  configureCompressor,
  getLimitsForTool,
} from '../tool-result-compressor.js';

describe('tool-result-compressor', () => {
  beforeEach(() => {
    // Reset any custom config
    configureCompressor({});
  });

  // ── getLimitsForTool ──────────────────────────────────────────────────

  describe('getLimitsForTool', () => {
    it('returns default limits for unknown tools', () => {
      const limits = getLimitsForTool('unknown_tool', 'small');
      expect(limits.maxLines).toBe(50);
      expect(limits.maxMatches).toBe(5);
      expect(limits.headTailSplit).toBe(true);
    });

    it('applies tool-specific overrides', () => {
      const limits = getLimitsForTool('file_read', 'small');
      expect(limits.maxLines).toBe(60); // file_read override
      expect(limits.headTailSplit).toBe(true);
    });

    it('returns large tier limits', () => {
      const limits = getLimitsForTool('file_read', 'large');
      expect(limits.maxLines).toBe(2000);
      expect(limits.headTailSplit).toBe(false);
    });

    it('applies user-configured overrides on top of built-in', () => {
      configureCompressor({
        toolLimits: {
          file_read: { small: { maxLines: 25, maxMatches: 2, headTailSplit: false } },
        },
      });
      const limits = getLimitsForTool('file_read', 'small');
      expect(limits.maxLines).toBe(25);
      expect(limits.maxMatches).toBe(2);
      expect(limits.headTailSplit).toBe(false);
    });

    it.each<ModelTier>(['small', 'medium', 'large'])('returns limits for tier %s', (tier) => {
      const limits = getLimitsForTool('file_grep', tier);
      expect(limits.maxLines).toBeGreaterThan(0);
      expect(limits.maxMatches).toBeGreaterThan(0);
    });
  });

  // ── compressToolResult ────────────────────────────────────────────────

  describe('compressToolResult', () => {
    it('returns empty string for empty content', () => {
      expect(compressToolResult('file_read', '', 'small')).toBe('');
    });

    it('passes through content within limits', () => {
      const content = Array.from({ length: 10 }, (_, i) => `line ${i}`).join('\n');
      expect(compressToolResult('file_read', content, 'small')).toBe(content);
    });

    it('truncates content exceeding small tier limits with head/tail split', () => {
      const lines = Array.from({ length: 200 }, (_, i) => `line ${i}`);
      const content = lines.join('\n');
      const result = compressToolResult('file_read', content, 'small');

      // Should contain truncation marker
      expect(result).toContain('lines omitted');
      // Should have first lines
      expect(result).toContain('line 0');
      // Should have last lines
      expect(result).toContain('line 199');
      // Should be shorter than original
      expect(result.split('\n').length).toBeLessThan(200);
    });

    it('truncates shell_exec output for small tier', () => {
      const lines = Array.from({ length: 100 }, (_, i) => `output ${i}`);
      const content = lines.join('\n');
      const result = compressToolResult('shell_exec', content, 'small');

      expect(result).toContain('lines omitted');
      expect(result).toContain('output 0');
      expect(result).toContain('output 99');
    });

    it('passes through large tier content for tools without specific limits', () => {
      const content = Array.from({ length: 500 }, (_, i) => `line ${i}`).join('\n');
      const result = compressToolResult('unknown_tool', content, 'large');
      expect(result).toBe(content);
    });

    it('still truncates large tier when tool has specific limits', () => {
      const lines = Array.from({ length: 3000 }, (_, i) => `line ${i}`);
      const content = lines.join('\n');
      const result = compressToolResult('file_read', content, 'large');

      // file_read large has maxLines: 2000, headTailSplit: false
      expect(result).toContain('more lines');
    });
  });

  // ── compressSearchResult ──────────────────────────────────────────────

  describe('compressSearchResult', () => {
    it('returns empty string for empty content', () => {
      expect(compressSearchResult('file_grep', '', 'small')).toBe('');
    });

    describe('file_grep', () => {
      it('limits grep matches for small tier', () => {
        const matches = Array.from(
          { length: 50 },
          (_, i) => `src/file${i}.ts:${i + 1}: const x = ${i}`,
        );
        const content = matches.join('\n');
        const result = compressSearchResult('file_grep', content, 'small');

        // Small tier maxMatches = 5
        expect(result).toContain('src/file0.ts');
        expect(result).toContain('showing first 5 matches');
      });

      it('passes through grep results within limits', () => {
        const matches = Array.from(
          { length: 3 },
          (_, i) => `src/file${i}.ts:${i + 1}: const x = ${i}`,
        );
        const content = matches.join('\n');
        const result = compressSearchResult('file_grep', content, 'small');
        expect(result).toBe(content);
      });

      it('handles grep separators correctly', () => {
        const content = [
          'file.ts:1: match 1',
          '--',
          'file.ts:5: match 2',
          '--',
          'file.ts:10: match 3',
        ].join('\n');
        const result = compressSearchResult('file_grep', content, 'small');
        expect(result).toContain('match 1');
      });
    });

    describe('file_glob', () => {
      it('limits file list for small tier', () => {
        const files = Array.from({ length: 30 }, (_, i) => `src/components/file${i}.tsx`);
        const content = files.join('\n');
        const result = compressSearchResult('file_glob', content, 'small');

        // Small tier maxMatches = 10 for file_glob
        expect(result).toContain('src/components/file0.tsx');
        expect(result).toContain('more files');
      });

      it('passes through short file lists', () => {
        const content = 'src/a.ts\nsrc/b.ts\nsrc/c.ts';
        expect(compressSearchResult('file_glob', content, 'small')).toBe(content);
      });
    });

    describe('project_context', () => {
      it('limits block results for small tier', () => {
        const blocks = Array.from(
          { length: 10 },
          (_, i) => `Rule ${i}: This is rule number ${i} with some content`,
        );
        const content = blocks.join('---');
        const result = compressSearchResult('project_context', content, 'small');

        // Small tier maxMatches = 3 for project_context
        expect(result).toContain('Rule 0');
        expect(result).toContain('more results');
      });
    });

    describe('fallback', () => {
      it('falls back to line-based truncation for unknown tools', () => {
        const content = Array.from({ length: 200 }, (_, i) => `line ${i}`).join('\n');
        const result = compressSearchResult('custom_search', content, 'small');
        expect(result).toContain('lines omitted');
      });
    });
  });
});
