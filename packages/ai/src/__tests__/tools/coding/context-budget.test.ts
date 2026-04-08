import { describe, expect, it } from 'vitest';
import {
  classifyModel,
  getContextBudget,
  getContextBudgetForModel,
  type Message,
  pruneHistory,
  truncateToolResult,
} from '../../../inference/context-budget.js';

describe('context budget', () => {
  describe('classifyModel', () => {
    it('classifies BitNet as small', () => {
      expect(classifyModel('bitnet-b1.58-2B-4T')).toBe('small');
    });

    it('classifies TinyLlama as small', () => {
      expect(classifyModel('tinyllama-1.1b')).toBe('small');
    });

    it('classifies 2B models as small', () => {
      expect(classifyModel('some-model-2b')).toBe('small');
    });

    it('classifies Llama 7B as medium', () => {
      expect(classifyModel('llama-3.2-7b')).toBe('medium');
    });

    it('classifies Llama 8B as medium', () => {
      expect(classifyModel('llama-3.2-8b')).toBe('medium');
    });

    it('classifies Mistral 7B as medium', () => {
      expect(classifyModel('mistral-7b-instruct')).toBe('medium');
    });

    it('classifies Llama 70B as medium', () => {
      expect(classifyModel('llama-3.3-70b-versatile')).toBe('medium');
    });

    it('classifies Mixtral as medium', () => {
      expect(classifyModel('mixtral-8x7b')).toBe('medium');
    });

    it('classifies Claude as large', () => {
      expect(classifyModel('claude-3.5-sonnet')).toBe('large');
      expect(classifyModel('claude-opus-4-6')).toBe('large');
    });

    it('classifies GPT-4 as large', () => {
      expect(classifyModel('gpt-4-turbo')).toBe('large');
      expect(classifyModel('gpt-5.4')).toBe('large');
    });

    it('classifies Gemini as large', () => {
      expect(classifyModel('gemini-3.1-flash')).toBe('large');
    });

    it('defaults unknown models to medium', () => {
      expect(classifyModel('some-unknown-model')).toBe('medium');
    });
  });

  describe('getContextBudget', () => {
    it('returns small budget', () => {
      const budget = getContextBudget('small');
      expect(budget.systemPromptTokens).toBe(400);
      expect(budget.toolResultMaxLines).toBe(100);
      expect(budget.historyTurns).toBe(2);
      expect(budget.preambleTiers).toEqual([1]);
    });

    it('returns medium budget', () => {
      const budget = getContextBudget('medium');
      expect(budget.systemPromptTokens).toBe(1200);
      expect(budget.toolResultMaxLines).toBe(300);
      expect(budget.historyTurns).toBe(6);
      expect(budget.preambleTiers).toEqual([1, 2]);
    });

    it('returns large budget', () => {
      const budget = getContextBudget('large');
      expect(budget.systemPromptTokens).toBe(4000);
      expect(budget.toolResultMaxLines).toBe(2000);
      expect(budget.historyTurns).toBe(20);
      expect(budget.preambleTiers).toEqual([1, 2, 3]);
    });

    it('returns a copy, not a reference', () => {
      const a = getContextBudget('small');
      const b = getContextBudget('small');
      expect(a).toEqual(b);
      a.historyTurns = 999;
      expect(b.historyTurns).not.toBe(999);
    });
  });

  describe('getContextBudgetForModel', () => {
    it('returns correct budget for a known model', () => {
      const budget = getContextBudgetForModel('bitnet-b1.58-2B-4T');
      expect(budget.historyTurns).toBe(2);
    });

    it('returns medium for unknown models', () => {
      const budget = getContextBudgetForModel('mystery-model');
      expect(budget.historyTurns).toBe(6);
    });
  });

  describe('truncateToolResult', () => {
    it('passes through short content unchanged', () => {
      const content = 'line 1\nline 2\nline 3';
      expect(truncateToolResult(content, 'large')).toBe(content);
    });

    it('truncates long content for small tier', () => {
      const lines = Array.from({ length: 200 }, (_, i) => `line ${i + 1}`);
      const content = lines.join('\n');
      const result = truncateToolResult(content, 'small');
      expect(result).toContain('lines omitted');
      expect(result.split('\n').length).toBeLessThan(200);
    });

    it('preserves head and tail', () => {
      const lines = Array.from({ length: 200 }, (_, i) => `line ${i + 1}`);
      const content = lines.join('\n');
      const result = truncateToolResult(content, 'small');
      expect(result).toContain('line 1');
      expect(result).toContain('line 200');
    });

    it('does not truncate within budget', () => {
      const lines = Array.from({ length: 50 }, (_, i) => `line ${i + 1}`);
      const content = lines.join('\n');
      expect(truncateToolResult(content, 'small')).toBe(content); // 50 < 100 (small budget)
    });

    it('uses 70/30 head/tail split', () => {
      const lines = Array.from({ length: 200 }, (_, i) => `line ${i + 1}`);
      const content = lines.join('\n');
      const result = truncateToolResult(content, 'small');
      // Small budget = 100 lines max, 70 head + 30 tail
      const resultLines = result.split('\n');
      const omittedIdx = resultLines.findIndex((l: string) => l.includes('omitted'));
      // The marker string has a leading \n which adds an empty line when joined
      expect(omittedIdx).toBeGreaterThanOrEqual(70);
      expect(omittedIdx).toBeLessThanOrEqual(72);
    });
  });

  describe('pruneHistory', () => {
    const messages: Message[] = [
      { role: 'system', content: 'You are a coding agent.' },
      { role: 'user', content: 'Turn 1' },
      { role: 'assistant', content: 'Response 1' },
      { role: 'tool', content: 'Tool result 1' },
      { role: 'user', content: 'Turn 2' },
      { role: 'assistant', content: 'Response 2' },
      { role: 'user', content: 'Turn 3' },
      { role: 'assistant', content: 'Response 3' },
      { role: 'user', content: 'Turn 4' },
      { role: 'assistant', content: 'Response 4' },
      { role: 'user', content: 'Turn 5' },
      { role: 'assistant', content: 'Response 5' },
    ];

    it('always keeps system messages', () => {
      const pruned = pruneHistory(messages, 'small');
      expect(pruned[0]).toEqual({ role: 'system', content: 'You are a coding agent.' });
    });

    it('keeps only recent turns for small models', () => {
      const pruned = pruneHistory(messages, 'small');
      // small = 2 turns × 3 messages = 6 most recent non-system messages
      const nonSystem = pruned.filter((m) => m.role !== 'system');
      expect(nonSystem.length).toBeLessThanOrEqual(6);
      // Should keep the most recent messages
      expect(nonSystem[nonSystem.length - 1]?.content).toBe('Response 5');
    });

    it('keeps more turns for large models', () => {
      const pruned = pruneHistory(messages, 'large');
      // large = 20 turns × 3 = 60 messages — more than we have, so keep all
      expect(pruned.length).toBe(messages.length);
    });

    it('handles empty messages', () => {
      expect(pruneHistory([], 'small')).toEqual([]);
    });

    it('handles system-only messages', () => {
      const systemOnly: Message[] = [{ role: 'system', content: 'sys' }];
      const pruned = pruneHistory(systemOnly, 'small');
      expect(pruned).toEqual(systemOnly);
    });
  });
});
