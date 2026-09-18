import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  DISMISSED_KEY,
  entitlesReceiptedAgentAction,
  markWalkStepVisited,
  ONBOARDING_WALK_KEY,
  planHonestyLine,
  readWalkProgress,
  resolveWalkCompletion,
  resolveWalkTier,
  shouldSurfaceKgWalk,
  walkProgressCounts,
  walkStepsForTier,
} from '../onboarding-walk';

afterEach(() => {
  localStorage.clear();
});

beforeEach(() => {
  localStorage.clear();
});

describe('resolveWalkTier', () => {
  it('returns null while loading or when resolve failed (does not invent Free)', () => {
    expect(resolveWalkTier({ tier: 'free', isLoading: true, resolveError: null })).toBeNull();
    expect(
      resolveWalkTier({
        tier: 'free',
        isLoading: false,
        resolveError: 'unavailable',
      }),
    ).toBeNull();
  });

  it('returns the resolved tier when the fetch succeeded', () => {
    expect(resolveWalkTier({ tier: 'max', isLoading: false, resolveError: null })).toBe('max');
  });
});

describe('entitlesReceiptedAgentAction', () => {
  it('is false for Free and unknown, true for paid agent plans', () => {
    expect(entitlesReceiptedAgentAction(null)).toBe(false);
    expect(entitlesReceiptedAgentAction('free')).toBe(false);
    expect(entitlesReceiptedAgentAction('pro')).toBe(true);
    expect(entitlesReceiptedAgentAction('max')).toBe(true);
    expect(entitlesReceiptedAgentAction('enterprise')).toBe(true);
  });
});

describe('planHonestyLine', () => {
  it('labels Free/Pro/Max and pins Max at $99/$799 with no stale $299', () => {
    const free = planHonestyLine('free');
    const pro = planHonestyLine('pro');
    const max = planHonestyLine('max');
    expect(free).toContain('Free (OSS)');
    expect(free).toContain('$49');
    expect(pro).toContain('Pro');
    expect(pro).toContain('$399');
    expect(max).toContain('Max');
    expect(max).toContain('$99/mo');
    expect(max).toContain('$799/yr');
    expect(free).toContain('$99/mo · $799/yr');
    expect(`${free}${pro}${max}`).not.toContain('$299');
  });

  it('does not claim Free when the plan is unknown', () => {
    const unknown = planHonestyLine(null);
    expect(unknown).toContain('will not guess Free');
    expect(unknown).toContain('$99/mo · $799/yr');
    expect(unknown.startsWith('You are on Free')).toBe(false);
  });
});

describe('walkStepsForTier', () => {
  it('sends Free to pages and upgrade, never an unlocked /agents path', () => {
    const steps = walkStepsForTier('free');
    expect(steps.map((step) => [step.id, step.href, step.kind])).toEqual([
      ['dashboard', '/dashboard', 'open'],
      ['planHonesty', '/account/billing', 'open'],
      ['firstDayAction', '/pages', 'open'],
      ['receiptedAction', '/upgrade', 'locked'],
      ['billing', '/account/billing', 'open'],
    ]);
    expect(steps.some((step) => step.href === '/agents' && step.kind === 'open')).toBe(false);
  });

  it('gives Pro/Max a receipted agent path', () => {
    for (const tier of ['pro', 'max'] as const) {
      const steps = walkStepsForTier(tier);
      const first = steps.find((step) => step.id === 'firstDayAction');
      const receipt = steps.find((step) => step.id === 'receiptedAction');
      expect(first?.href).toBe('/agents');
      expect(first?.kind).toBe('open');
      expect(receipt?.href).toBe('/agent-tasks');
      expect(receipt?.kind).toBe('open');
    }
  });

  it('fails closed to the Free first-day path when tier is unknown', () => {
    const steps = walkStepsForTier(null);
    expect(steps.find((step) => step.id === 'firstDayAction')?.href).toBe('/pages');
    expect(steps.find((step) => step.id === 'receiptedAction')?.kind).toBe('locked');
  });

  it('omits Knowledge Graph for Free/Pro when the #2884 gate does not allow it', () => {
    for (const tier of ['free', 'pro', 'max', null] as const) {
      const steps = walkStepsForTier(tier);
      expect(steps.some((step) => step.id === 'knowledgeGraph')).toBe(false);
      expect(steps.some((step) => step.href === '/knowledge-graph')).toBe(false);
    }
  });

  it('surfaces Knowledge Graph as a bird-eye admin link when the gate allows', () => {
    const steps = walkStepsForTier('pro', { kgEntitled: true });
    const kg = steps.find((step) => step.id === 'knowledgeGraph');
    expect(kg?.href).toBe('/knowledge-graph');
    expect(kg?.kind).toBe('open');
    expect(kg?.description.toLowerCase()).toContain('problems');
    expect(kg?.description.toLowerCase()).toContain('stack');
    expect(kg?.description.toLowerCase()).toContain('next sku');
    expect(kg?.description.toLowerCase()).toContain('not a fourth product');
    expect(kg?.description.toLowerCase()).toContain('links');
    expect(kg?.description.includes('/tmp')).toBe(false);
    expect(kg?.description.includes('file:')).toBe(false);
    expect(kg?.description.toLowerCase().includes('live nodes')).toBe(false);
  });

  it('teases Launch/licensed architecture diagrams from KG, without a Mermaid job or Architecture SKU', () => {
    const gated = walkStepsForTier('pro', { kgEntitled: true })
      .find((step) => step.id === 'knowledgeGraph')
      ?.description.toLowerCase();
    expect(gated).toContain('architecture diagrams');
    expect(gated).toContain('knowledge graph');
    expect(gated).toContain('launch');
    expect(gated).toContain('licensed');
    expect(gated).toContain('graph wins');
    expect(gated?.includes('mermaid')).toBe(false);
    expect(gated?.includes('architecture sku')).toBe(false);

    for (const tier of ['free', 'pro'] as const) {
      const blob = JSON.stringify(walkStepsForTier(tier)).toLowerCase();
      expect(blob.includes('architecture diagrams')).toBe(false);
      expect(blob.includes('architecture sku')).toBe(false);
      expect(blob.includes('mermaid')).toBe(false);
    }
  });
});

describe('shouldSurfaceKgWalk', () => {
  it('requires both Pro AI and the #2884 dual-gate; never invents live KG', () => {
    expect(shouldSurfaceKgWalk({ hasProAi: false, kgShapesAllowed: true })).toBe(false);
    expect(shouldSurfaceKgWalk({ hasProAi: true, kgShapesAllowed: false })).toBe(false);
    expect(shouldSurfaceKgWalk({ hasProAi: true, kgShapesAllowed: true })).toBe(true);
    expect(shouldSurfaceKgWalk({ hasProAi: false, kgShapesAllowed: false })).toBe(false);
  });
});

describe('resolveWalkCompletion', () => {
  const freeSteps = walkStepsForTier('free');
  const proSteps = walkStepsForTier('pro');
  const emptySignals = { hasAgents: false, hasAgentTasks: false, hasPages: false };

  it('marks dashboard from land, pages from live data, and never completes a locked receipt', () => {
    const completion = resolveWalkCompletion(
      freeSteps,
      { ...emptySignals, hasPages: true },
      {},
      true,
    );
    expect(completion.dashboard).toBe(true);
    expect(completion.firstDayAction).toBe(true);
    expect(completion.receiptedAction).toBe(false);
    expect(completion.billing).toBe(false);
  });

  it('marks Pro agent + receipt from live signals and billing from persisted visits', () => {
    const completion = resolveWalkCompletion(
      proSteps,
      { hasAgents: true, hasAgentTasks: true, hasPages: false },
      { billing: true },
      true,
    );
    expect(completion.firstDayAction).toBe(true);
    expect(completion.receiptedAction).toBe(true);
    expect(completion.planHonesty).toBe(true);
    expect(completion.billing).toBe(true);
  });

  it('persists visits across reads', () => {
    markWalkStepVisited('planHonesty');
    markWalkStepVisited('billing');
    expect(readWalkProgress().visited).toEqual({
      planHonesty: true,
      billing: true,
    });
    expect(localStorage.getItem(ONBOARDING_WALK_KEY)).toContain('planHonesty');
    expect(localStorage.getItem(DISMISSED_KEY)).toBeNull();
  });

  it('counts only open steps toward progress', () => {
    const completion = resolveWalkCompletion(freeSteps, emptySignals, {}, true);
    expect(walkProgressCounts(freeSteps, completion)).toEqual({
      completed: 1,
      total: 4,
    });
  });

  it('never marks Knowledge Graph complete from live agent/page signals', () => {
    const kgSteps = walkStepsForTier('pro', { kgEntitled: true });
    const completion = resolveWalkCompletion(
      kgSteps,
      { hasAgents: true, hasAgentTasks: true, hasPages: true },
      {},
      true,
    );
    expect(completion.knowledgeGraph).toBe(false);
    expect(
      resolveWalkCompletion(kgSteps, emptySignals, { knowledgeGraph: true }, true).knowledgeGraph,
    ).toBe(true);
  });
});
