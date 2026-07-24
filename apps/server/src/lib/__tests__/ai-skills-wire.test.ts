import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const createAgentSkillProvider = vi.fn(() => ({ injectSkillInstructions: vi.fn() }));
const SkillActivator = vi.fn(function SkillActivator(this: unknown) {
  return this;
});

vi.mock('@revealui/ai/skills', () => ({
  createAgentSkillProvider,
  globalSkillRegistry: { name: 'global' },
  SkillActivator,
}));

describe('ai-skills-wire', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('is disabled by default', async () => {
    const { isAiSkillsWireEnabled, createSkillProviderIfEnabled } = await import(
      '../ai-skills-wire.js'
    );
    expect(isAiSkillsWireEnabled({})).toBe(false);
    await expect(createSkillProviderIfEnabled({})).resolves.toBeNull();
    expect(createAgentSkillProvider).not.toHaveBeenCalled();
  });

  it('builds provider when REVEALUI_AI_SKILLS=1', async () => {
    const { createSkillProviderIfEnabled } = await import('../ai-skills-wire.js');
    const provider = await createSkillProviderIfEnabled({ REVEALUI_AI_SKILLS: '1' });
    expect(provider).not.toBeNull();
    expect(SkillActivator).toHaveBeenCalledOnce();
    expect(createAgentSkillProvider).toHaveBeenCalledOnce();
  });
});
