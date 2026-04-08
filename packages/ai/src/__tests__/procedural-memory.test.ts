import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ProceduralMemory,
  type WorkflowContext,
  type WorkflowStep,
} from '../memory/stores/procedural-memory.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a simple step that resolves with a value */
function makeStep(
  id: string,
  label: string,
  returnValue: unknown = id,
  options: Partial<WorkflowStep> = {},
): WorkflowStep {
  return {
    id,
    label,
    type: 'action',
    execute: vi.fn().mockResolvedValue(returnValue),
    ...options,
  };
}

/** Creates a step that rejects with an error */
function makeFailingStep(id: string, message: string): WorkflowStep {
  return {
    id,
    label: id,
    type: 'action',
    execute: vi.fn().mockRejectedValue(new Error(message)),
  };
}

// ---------------------------------------------------------------------------

describe('ProceduralMemory', () => {
  let mem: ProceduralMemory;

  beforeEach(() => {
    mem = new ProceduralMemory();
  });

  // -------------------------------------------------------------------------
  // register / has / unregister / listWorkflows
  // -------------------------------------------------------------------------

  describe('registration', () => {
    it('registers a workflow', () => {
      mem.register('my-flow', [makeStep('s1', 'Step 1')]);
      expect(mem.has('my-flow')).toBe(true);
    });

    it('returns false for an unregistered workflow', () => {
      expect(mem.has('unknown')).toBe(false);
    });

    it('overwrites an existing workflow with the same name', () => {
      mem.register('flow', [makeStep('s1', 'Step 1')]);
      mem.register('flow', [makeStep('s2', 'Step 2'), makeStep('s3', 'Step 3')]);
      expect(mem.getDefinition('flow')!.steps).toHaveLength(2);
    });

    it('unregisters a workflow', () => {
      mem.register('flow', [makeStep('s1', 'Step 1')]);
      mem.unregister('flow');
      expect(mem.has('flow')).toBe(false);
    });

    it('does not throw when unregistering a non-existent workflow', () => {
      expect(() => mem.unregister('no-such-flow')).not.toThrow();
    });

    it('lists registered workflow names', () => {
      mem.register('alpha', [makeStep('s1', 'a')]);
      mem.register('beta', [makeStep('s2', 'b')]);
      expect(mem.listWorkflows()).toContain('alpha');
      expect(mem.listWorkflows()).toContain('beta');
      expect(mem.listWorkflows()).toHaveLength(2);
    });

    it('returns an empty list when no workflows are registered', () => {
      expect(mem.listWorkflows()).toEqual([]);
    });

    it('getDefinition returns the stored definition', () => {
      const steps = [makeStep('s1', 'Step')];
      mem.register('flow', steps, 'my description');
      const def = mem.getDefinition('flow')!;
      expect(def.name).toBe('flow');
      expect(def.description).toBe('my description');
      expect(def.steps).toHaveLength(1);
      expect(typeof def.createdAt).toBe('number');
    });

    it('getDefinition returns undefined for unknown workflow', () => {
      expect(mem.getDefinition('unknown')).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // execute — sequential
  // -------------------------------------------------------------------------

  describe('execute — sequential steps', () => {
    it('throws when the workflow is not registered', async () => {
      await expect(mem.execute('unknown')).rejects.toThrow('Workflow "unknown" is not registered');
    });

    it('executes a single step and returns success', async () => {
      const step = makeStep('s1', 'Step 1', 'done');
      mem.register('flow', [step]);

      const result = await mem.execute('flow', {});

      expect(result.workflow).toBe('flow');
      expect(result.success).toBe(true);
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0]).toEqual({ id: 's1', status: 'ok', result: 'done' });
    });

    it('executes multiple sequential steps in order', async () => {
      const order: string[] = [];
      const steps: WorkflowStep[] = [
        {
          id: 's1',
          label: 'first',
          type: 'action',
          execute: vi.fn().mockImplementation(async () => {
            order.push('s1');
            return 'first';
          }),
        },
        {
          id: 's2',
          label: 'second',
          type: 'action',
          execute: vi.fn().mockImplementation(async () => {
            order.push('s2');
            return 'second';
          }),
        },
        {
          id: 's3',
          label: 'third',
          type: 'action',
          execute: vi.fn().mockImplementation(async () => {
            order.push('s3');
            return 'third';
          }),
        },
      ];
      mem.register('flow', steps);

      const result = await mem.execute('flow');

      expect(order).toEqual(['s1', 's2', 's3']);
      expect(result.success).toBe(true);
      expect(result.steps.map((s) => s.id)).toEqual(['s1', 's2', 's3']);
    });

    it('passes the context to each step', async () => {
      const captured: WorkflowContext[] = [];
      const step: WorkflowStep = {
        id: 's1',
        label: 'capture',
        type: 'action',
        execute: vi.fn().mockImplementation(async (ctx: WorkflowContext) => {
          captured.push({ ...ctx });
          return 'ok';
        }),
      };
      mem.register('flow', [step]);

      await mem.execute('flow', { userId: 'u1', role: 'admin' });

      expect(captured[0]).toMatchObject({ userId: 'u1', role: 'admin' });
    });

    it('records step errors and sets success=false', async () => {
      mem.register('flow', [
        makeStep('s1', 'ok step'),
        makeFailingStep('s2', 'boom'),
        makeStep('s3', 'after fail'),
      ]);

      const result = await mem.execute('flow');

      expect(result.success).toBe(false);
      expect(result.steps[1]).toEqual({ id: 's2', status: 'error', error: 'boom' });
      // s3 still runs — errors don't abort
      expect(result.steps[2].status).toBe('ok');
    });

    it('includes a durationMs field that is a non-negative number', async () => {
      mem.register('flow', [makeStep('s1', 'Step')]);
      const result = await mem.execute('flow');
      expect(typeof result.durationMs).toBe('number');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  // -------------------------------------------------------------------------
  // execute — parallel steps
  // -------------------------------------------------------------------------

  describe('execute — parallel steps', () => {
    it('executes steps with parallel:true concurrently', async () => {
      const startTimes: number[] = [];

      const makeParallelStep = (id: string): WorkflowStep => ({
        id,
        label: id,
        type: 'parallel',
        parallel: true,
        execute: vi.fn().mockImplementation(async () => {
          startTimes.push(Date.now());
          return id;
        }),
      });

      const steps: WorkflowStep[] = [
        makeParallelStep('p1'),
        // p2 is the last in the batch (parallel: false) — it flushes the batch
        {
          id: 'p2',
          label: 'p2',
          type: 'action',
          parallel: false,
          execute: vi.fn().mockResolvedValue('p2'),
        },
        makeStep('s3', 'sequential after'),
      ];

      mem.register('flow', steps);
      const result = await mem.execute('flow');

      expect(result.success).toBe(true);
      // All three step IDs should appear in results
      expect(result.steps.map((s) => s.id)).toEqual(['p1', 'p2', 's3']);
    });

    it('collects errors from parallel steps individually', async () => {
      const steps: WorkflowStep[] = [
        {
          id: 'ok',
          label: 'ok',
          type: 'parallel',
          parallel: true,
          execute: vi.fn().mockResolvedValue('fine'),
        },
        {
          id: 'fail',
          label: 'fail',
          type: 'action',
          parallel: false,
          execute: vi.fn().mockRejectedValue(new Error('parallel fail')),
        },
      ];
      mem.register('flow', steps);

      const result = await mem.execute('flow');

      expect(result.success).toBe(false);
      const okStep = result.steps.find((s) => s.id === 'ok')!;
      const failStep = result.steps.find((s) => s.id === 'fail')!;
      expect(okStep.status).toBe('ok');
      expect(failStep.status).toBe('error');
      expect(failStep.error).toBe('parallel fail');
    });
  });

  // -------------------------------------------------------------------------
  // edge cases
  // -------------------------------------------------------------------------

  describe('edge cases', () => {
    it('executes a workflow with no steps', async () => {
      mem.register('empty', []);
      const result = await mem.execute('empty');
      expect(result.success).toBe(true);
      expect(result.steps).toHaveLength(0);
    });

    it('accepts an empty context', async () => {
      mem.register('flow', [makeStep('s1', 'Step')]);
      await expect(mem.execute('flow')).resolves.toBeTruthy();
    });

    it('accepts no context argument (defaults to empty object)', async () => {
      const captured: WorkflowContext[] = [];
      const step: WorkflowStep = {
        id: 's1',
        label: 's1',
        type: 'action',
        execute: vi.fn().mockImplementation(async (ctx: WorkflowContext) => {
          captured.push(ctx);
          return 'ok';
        }),
      };
      mem.register('flow', [step]);
      await mem.execute('flow'); // no context arg
      expect(captured[0]).toEqual({});
    });
  });
});
