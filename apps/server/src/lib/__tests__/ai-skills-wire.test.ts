import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const loadAllSkills = vi.fn().mockResolvedValue(undefined);
const getAll = vi.fn().mockReturnValue([{ metadata: { name: 'demo' } }]);
const SkillRegistry = vi.fn(function SkillRegistry(this: {
  loadAllSkills: typeof loadAllSkills;
  getAll: typeof getAll;
}) {
  this.loadAllSkills = loadAllSkills;
  this.getAll = getAll;
  return this;
});
const loadAllFromDirectory = vi.fn().mockResolvedValue([{ metadata: { name: 'extra' } }]);
const createAgentSkillProvider = vi.fn(() => ({ injectSkillInstructions: vi.fn() }));
const SkillActivator = vi.fn(function SkillActivator(this: unknown) {
  return this;
});

vi.mock('@revealui/ai/skills', () => ({
  createAgentSkillProvider,
  globalSkillRegistry: { name: 'global' },
  SkillActivator,
  SkillRegistry,
  loadAllFromDirectory,
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

  it('builds provider and loads registry catalog when REVEALUI_AI_SKILLS=1', async () => {
    const { createSkillProviderIfEnabled } = await import('../ai-skills-wire.js');
    const provider = await createSkillProviderIfEnabled({ REVEALUI_AI_SKILLS: '1' });
    expect(provider).not.toBeNull();
    expect(SkillRegistry).toHaveBeenCalledOnce();
    expect(loadAllSkills).toHaveBeenCalledWith(false);
    expect(SkillActivator).toHaveBeenCalledOnce();
    expect(createAgentSkillProvider).toHaveBeenCalledOnce();
  });

  it('loads extra catalog dirs from REVEALUI_AI_SKILLS_DIRS', async () => {
    const { createSkillProviderIfEnabled, parseSkillCatalogDirs } = await import(
      '../ai-skills-wire.js'
    );
    expect(parseSkillCatalogDirs({ REVEALUI_AI_SKILLS_DIRS: '/a/skills,/b/skills' })).toEqual([
      '/a/skills',
      '/b/skills',
    ]);
    expect(parseSkillCatalogDirs({ REVEALUI_AI_SKILLS_DIRS: '/a:/b' })).toEqual(['/a', '/b']);

    await createSkillProviderIfEnabled({
      REVEALUI_AI_SKILLS: '1',
      REVEALUI_AI_SKILLS_DIRS: '/extra/skills',
    });
    expect(loadAllFromDirectory).toHaveBeenCalledWith(
      '/extra/skills',
      expect.objectContaining({ scope: 'local' }),
    );
  });
});
