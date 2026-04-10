import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tool } from '../../tools/base.js';
import {
  configureDecomposer,
  type DecomposedStep,
  decomposeTask,
  estimateComplexity,
  selectToolsForStep,
  shouldDecompose,
} from '../task-decomposer.js';

describe('task-decomposer', () => {
  beforeEach(() => {
    configureDecomposer({ maxSteps: 5, modelName: 'unknown', minComplexityForDecomposition: 1 });
  });

  // ── estimateComplexity ──────────────────────────────────────────────

  describe('estimateComplexity', () => {
    it('returns 0 for a simple instruction', () => {
      expect(estimateComplexity('read the file')).toBe(0);
    });

    it('scores higher for multiple "and" conjunctions', () => {
      const score = estimateComplexity('read the file and parse the JSON and update the config');
      expect(score).toBeGreaterThanOrEqual(1.5);
    });

    it('scores higher for sequential instructions', () => {
      const score = estimateComplexity('first read the config then update the database');
      expect(score).toBeGreaterThanOrEqual(3); // "first...then" + "then"
    });

    it('detects bulk operations', () => {
      const score = estimateComplexity('update all the test files');
      expect(score).toBeGreaterThanOrEqual(1.5);
    });

    it('detects refactoring signals', () => {
      const score = estimateComplexity('refactor the Button component');
      expect(score).toBeGreaterThanOrEqual(1.5);
    });

    it('adds score for long instructions', () => {
      const words = Array.from({ length: 70 }, (_, i) => `word${i}`).join(' ');
      const score = estimateComplexity(words);
      expect(score).toBeGreaterThanOrEqual(2); // >30 words + >60 words
    });

    it('adds score for multiple file references', () => {
      const score = estimateComplexity('update src/index.ts and src/config.ts and src/utils.ts');
      expect(score).toBeGreaterThanOrEqual(1.5);
    });

    it('caps at 10', () => {
      // Trigger as many signals as possible
      const complex =
        'first refactor and migrate all the multiple files across several directories, ' +
        'then create new tests with updated configs and then rewrite the entire module ' +
        'touching src/a.ts src/b.ts src/c.ts src/d.ts src/e.ts';
      expect(estimateComplexity(complex)).toBeLessThanOrEqual(10);
    });
  });

  // ── shouldDecompose ───────────────────────────────────────────────────

  describe('shouldDecompose', () => {
    it('never decomposes for large models', () => {
      expect(shouldDecompose('refactor all the things and migrate the database', 'large')).toBe(
        false,
      );
    });

    it('decomposes non-trivial tasks for small models', () => {
      expect(
        shouldDecompose('read the file and parse the data and then update the test', 'small'),
      ).toBe(true);
    });

    it('does not decompose trivial tasks for small models', () => {
      expect(shouldDecompose('read the file', 'small')).toBe(false);
    });

    it('decomposes complex tasks for medium models', () => {
      expect(
        shouldDecompose(
          'first refactor the component then update all the test files across the codebase',
          'medium',
        ),
      ).toBe(true);
    });

    it('does not decompose moderate tasks for medium models', () => {
      expect(shouldDecompose('update the config and add a test', 'medium')).toBe(false);
    });
  });

  // ── decomposeTask ─────────────────────────────────────────────────────

  describe('decomposeTask', () => {
    it('returns single step when decomposition is not needed', async () => {
      const llmClient = { stream: vi.fn() };
      const result = await decomposeTask('read the file', llmClient as never, 'claude-3');

      expect(result.decomposed).toBe(false);
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0]!.instruction).toBe('read the file');
      expect(result.metadata?.modelTier).toBe('large');
    });

    it('decomposes complex tasks for small models', async () => {
      const stepJson = JSON.stringify([
        {
          instruction: 'Read src/index.ts',
          toolHints: ['file_read'],
          targetPaths: ['src/index.ts'],
        },
        {
          instruction: 'Edit src/index.ts to add export',
          toolHints: ['file_edit'],
          targetPaths: ['src/index.ts'],
        },
      ]);

      const llmClient = {
        stream: vi.fn().mockImplementation(async function* () {
          yield { content: stepJson };
        }),
      };

      const result = await decomposeTask(
        'read the file and update the test and then fix all imports',
        llmClient as never,
        'gemma4:e2b',
      );

      expect(result.decomposed).toBe(true);
      expect(result.steps.length).toBeGreaterThanOrEqual(2);
      expect(result.steps[0]!.index).toBe(1);
      expect(result.steps[0]!.instruction).toBe('Read src/index.ts');
      expect(result.steps[0]!.toolHints).toEqual(['file_read']);
    });

    it('falls back to single step on LLM error', async () => {
      const llmClient = {
        // biome-ignore lint/correctness/useYield: generator must throw before yielding to simulate LLM error
        stream: vi.fn().mockImplementation(async function* () {
          throw new Error('LLM unavailable');
        }),
      };

      const instruction = 'refactor all the things and migrate everything';
      const result = await decomposeTask(instruction, llmClient as never, 'gemma4:e2b');

      expect(result.decomposed).toBe(false);
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0]!.instruction).toBe(instruction);
    });

    it('falls back on invalid JSON response', async () => {
      const llmClient = {
        stream: vi.fn().mockImplementation(async function* () {
          yield { content: 'This is not JSON at all' };
        }),
      };

      const instruction = 'refactor and migrate all the multiple files across directories';
      const result = await decomposeTask(instruction, llmClient as never, 'gemma4:e2b');

      expect(result.decomposed).toBe(false);
      expect(result.steps).toHaveLength(1);
    });

    it('limits steps to maxSteps config', async () => {
      configureDecomposer({ maxSteps: 2, modelName: 'unknown', minComplexityForDecomposition: 1 });

      const stepJson = JSON.stringify([
        { instruction: 'Step 1' },
        { instruction: 'Step 2' },
        { instruction: 'Step 3' },
        { instruction: 'Step 4' },
      ]);

      const llmClient = {
        stream: vi.fn().mockImplementation(async function* () {
          yield { content: stepJson };
        }),
      };

      const result = await decomposeTask(
        'refactor and migrate all files and update tests across the codebase',
        llmClient as never,
        'gemma4:e2b',
      );

      expect(result.steps.length).toBeLessThanOrEqual(2);
    });

    it('handles markdown-wrapped JSON response', async () => {
      const llmClient = {
        stream: vi.fn().mockImplementation(async function* () {
          yield {
            content: '```json\n[{"instruction": "Read the file", "toolHints": ["file_read"]}]\n```',
          };
        }),
      };

      const result = await decomposeTask(
        'refactor and migrate all the multiple files across directories',
        llmClient as never,
        'gemma4:e2b',
      );

      expect(result.decomposed).toBe(false); // Only 1 step, so decomposed = false
      expect(result.steps[0]!.instruction).toBe('Read the file');
    });

    it('records planning time in metadata', async () => {
      const llmClient = { stream: vi.fn() };
      const result = await decomposeTask('simple task', llmClient as never, 'claude-3');
      expect(result.metadata?.planningTime).toBeGreaterThanOrEqual(0);
    });
  });

  // ── selectToolsForStep ────────────────────────────────────────────────

  describe('selectToolsForStep', () => {
    const mockTools: Tool[] = [
      { name: 'file_read', description: 'Read', inputSchema: {}, execute: vi.fn() },
      { name: 'file_edit', description: 'Edit', inputSchema: {}, execute: vi.fn() },
      { name: 'shell_exec', description: 'Shell', inputSchema: {}, execute: vi.fn() },
    ];

    it('returns all tools when no hints provided', () => {
      const step: DecomposedStep = { index: 1, instruction: 'do something' };
      expect(selectToolsForStep(step, mockTools)).toEqual(mockTools);
    });

    it('filters tools by hint', () => {
      const step: DecomposedStep = {
        index: 1,
        instruction: 'read file',
        toolHints: ['file_read'],
      };
      const selected = selectToolsForStep(step, mockTools);
      expect(selected).toHaveLength(1);
      expect(selected[0]!.name).toBe('file_read');
    });

    it('returns multiple hinted tools', () => {
      const step: DecomposedStep = {
        index: 1,
        instruction: 'read and edit',
        toolHints: ['file_read', 'file_edit'],
      };
      const selected = selectToolsForStep(step, mockTools);
      expect(selected).toHaveLength(2);
    });

    it('falls back to all tools when no hints match', () => {
      const step: DecomposedStep = {
        index: 1,
        instruction: 'do something',
        toolHints: ['nonexistent_tool'],
      };
      expect(selectToolsForStep(step, mockTools)).toEqual(mockTools);
    });

    it('returns all tools for empty hints array', () => {
      const step: DecomposedStep = {
        index: 1,
        instruction: 'do something',
        toolHints: [],
      };
      expect(selectToolsForStep(step, mockTools)).toEqual(mockTools);
    });
  });
});
