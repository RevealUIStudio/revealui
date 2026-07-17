import { describe, expect, it } from 'vitest';
import { OpenCodeGenerator } from '../content/generators/opencode.js';
import { buildManifest, generateContent, getGenerator, listGenerators } from '../content/index.js';
import type { Agent, Command, Rule, Skill } from '../content/schemas/index.js';

const ctx = { projectRoot: '/test' };

describe('OpenCodeGenerator', () => {
  it('is auto-registered in the content generator registry', () => {
    expect(listGenerators()).toContain('opencode');
    expect(getGenerator('opencode')).toBeInstanceOf(OpenCodeGenerator);
  });

  it('declares its output directory', () => {
    const generator = new OpenCodeGenerator();
    expect(generator.id).toBe('opencode');
    expect(generator.outputDir).toBe('.opencode');
  });

  describe('generateCommand', () => {
    it('writes a frontmatter markdown file under .opencode/commands/', () => {
      const cmd: Command = {
        id: 'gate',
        name: 'Gate',
        description: 'Run the quality gate',
        tier: 'oss',
        disableModelInvocation: false,
        content: 'Run lint, typecheck, and tests.',
      };
      const files = new OpenCodeGenerator().generateCommand(cmd, ctx);
      expect(files).toHaveLength(1);
      expect(files[0]?.relativePath).toBe('.opencode/commands/gate.md');
      expect(files[0]?.content).toContain('description: Run the quality gate');
      expect(files[0]?.content).toContain('Run lint, typecheck, and tests.');
    });

    it('includes argument-hint and disable-model-invocation when set', () => {
      const cmd: Command = {
        id: 'deploy',
        name: 'Deploy',
        description: 'Deploy the app',
        tier: 'oss',
        disableModelInvocation: true,
        argumentHint: '[environment]',
        content: 'Deploy steps.',
      };
      const [file] = new OpenCodeGenerator().generateCommand(cmd, ctx);
      expect(file?.content).toContain('argument-hint: [environment]');
      expect(file?.content).toContain('disable-model-invocation: true');
    });
  });

  describe('generateAgent', () => {
    it('writes a frontmatter markdown file under .opencode/agents/', () => {
      const agent: Agent = {
        id: 'reviewer',
        name: 'Reviewer',
        description: 'Reviews code',
        tier: 'oss',
        isolation: 'none',
        tools: ['Read', 'Grep'],
        content: 'You review code for quality.',
      };
      const [file] = new OpenCodeGenerator().generateAgent(agent, ctx);
      expect(file?.relativePath).toBe('.opencode/agents/reviewer.md');
      expect(file?.content).toContain('description: Reviews code');
      expect(file?.content).toContain('tools: Read, Grep');
      expect(file?.content).toContain('You review code for quality.');
    });
  });

  describe('generateRule / generateSkill -- no native OpenCode surface', () => {
    it('generateRule returns no files (folded into AGENTS.md by a different generator)', () => {
      const rule: Rule = {
        id: 'biome',
        name: 'Biome',
        description: 'Use biome',
        scope: 'project',
        preambleTier: 2,
        tier: 'oss',
        tags: [],
        content: 'Format with biome.',
      };
      expect(new OpenCodeGenerator().generateRule(rule, ctx)).toEqual([]);
    });

    it('generateSkill returns no files (no documented native OpenCode skills surface)', () => {
      const skill: Skill = {
        id: 'tdd',
        name: 'TDD',
        description: 'Test-driven development',
        tier: 'oss',
        disableModelInvocation: false,
        skipFrontmatter: false,
        filePatterns: [],
        bashPatterns: [],
        references: {},
        content: 'Write tests first.',
      };
      expect(new OpenCodeGenerator().generateSkill(skill, ctx)).toEqual([]);
    });
  });

  describe('generateAll / generateContent over the real manifest', () => {
    it('emits exactly one file per command and one per agent, nothing for rules/skills', () => {
      const manifest = buildManifest();
      const files = generateContent('opencode', manifest, ctx);

      expect(files).toHaveLength(manifest.commands.length + manifest.agents.length);
      for (const cmd of manifest.commands) {
        expect(files.some((f) => f.relativePath === `.opencode/commands/${cmd.id}.md`)).toBe(true);
      }
      for (const agent of manifest.agents) {
        expect(files.some((f) => f.relativePath === `.opencode/agents/${agent.id}.md`)).toBe(true);
      }
      expect(files.some((f) => f.relativePath.startsWith('.opencode/rules/'))).toBe(false);
      expect(files.some((f) => f.relativePath.startsWith('.opencode/skills/'))).toBe(false);
    });
  });
});
