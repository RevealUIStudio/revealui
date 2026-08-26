import { describe, expect, it } from 'vitest';
import { buildManifest } from '../content/definitions/index.js';
import {
  GROK_MANAGER_RULE_PATH,
  GROK_OUTPUT_DIR,
  GROK_SPAWN_MAP_PATH,
  GrokGenerator,
  grokOnDemandSkillPath,
  grokRulePathForDefinitionId,
} from '../content/generators/grok.js';
import { getGenerator, listGenerators } from '../content/index.js';
import { alwaysOnRuleIds } from '../content/preamble-ids.js';
import type { Rule } from '../content/schemas/index.js';

const ctx = { projectRoot: '/test' };

function sampleRule(preambleTier: 1 | 2, id: string): Rule {
  return {
    id,
    name: id,
    description: `Rule ${id}`,
    scope: 'project',
    preambleTier,
    tier: 'oss',
    tags: [],
    content: `# ${id}\n\nBody for ${id}.\n`,
  };
}

describe('GrokGenerator', () => {
  it('is registered and lands under .grok', () => {
    expect(listGenerators()).toContain('grok');
    expect(getGenerator('grok')).toBeInstanceOf(GrokGenerator);
    const generator = new GrokGenerator();
    expect(generator.id).toBe('grok');
    expect(generator.outputDir).toBe(GROK_OUTPUT_DIR);
  });

  it('emits preamble-tier-1 rules under .grok/rules/', () => {
    const files = new GrokGenerator().generateRule(sampleRule(1, 'tracker-first'), ctx);
    expect(files).toHaveLength(1);
    expect(files[0]?.relativePath).toBe(grokRulePathForDefinitionId('tracker-first'));
    expect(files[0]?.content).toContain('Body for tracker-first');
  });

  it('emits other rules as on-demand skills', () => {
    const files = new GrokGenerator().generateRule(sampleRule(2, 'database'), ctx);
    expect(files).toHaveLength(1);
    expect(files[0]?.relativePath).toBe(grokOnDemandSkillPath('database'));
    expect(files[0]?.content).toContain('name: rule-database');
    expect(files[0]?.content).toContain('Body for database');
  });

  it('generateAll writes constitution + spawn map + agents, not the full dump', () => {
    const manifest = buildManifest();
    const alwaysOn = alwaysOnRuleIds(manifest);
    const files = new GrokGenerator().generateAll(manifest, ctx);
    const ruleFiles = files.filter(
      (f) => f.relativePath.startsWith('.grok/rules/') && f.relativePath.endsWith('.md'),
    );
    const skillFiles = files.filter((f) => f.relativePath.includes('/skills/rule-'));
    expect(files.some((f) => f.relativePath === GROK_SPAWN_MAP_PATH)).toBe(true);
    expect(files.some((f) => f.relativePath === GROK_MANAGER_RULE_PATH)).toBe(true);
    expect(ruleFiles.length).toBe(alwaysOn.size + 2);
    expect(skillFiles.length).toBe(manifest.rules.length - alwaysOn.size);
    expect(files.some((f) => f.relativePath === '.grok/agents/builder.md')).toBe(true);
    const spawn = files.find((f) => f.relativePath === GROK_SPAWN_MAP_PATH);
    expect(spawn?.content).toContain('implementer');
    expect(spawn?.content).toContain('builder');
    const orientation = files.find((f) => f.relativePath === GROK_MANAGER_RULE_PATH);
    expect(orientation?.content).toContain('rfg');
    expect(orientation?.content).toContain('Do not author policy there');
    expect(orientation?.content).not.toContain('joshua');
    expect(orientation?.content).not.toContain('revfleet/.jv');
  });

  it('does not re-emit content skills (avoids catalog collisions)', () => {
    const files = new GrokGenerator().generateSkill(
      {
        id: 'revealui-tdd',
        name: 'revealui-tdd',
        description: 'TDD',
        tier: 'oss',
        disableModelInvocation: false,
        skipFrontmatter: false,
        filePatterns: [],
        bashPatterns: [],
        references: {},
        content: 'tdd',
      },
      ctx,
    );
    expect(files).toEqual([]);
  });
});
