import { describe, expect, it } from 'vitest';
import { ClaudeCodeGenerator } from '../content/generators/claude-code.js';
import {
  buildManifest,
  DEFAULT_CONTENT_GENERATOR_ID,
  generateContent,
  getGenerator,
  listGenerators,
  MANAGER_CONTENT_OUTPUT,
} from '../content/index.js';
import type { Agent, Command, Rule, Skill } from '../content/schemas/index.js';

const ctx = { projectRoot: '/test' };

describe('ClaudeCodeGenerator', () => {
  it('is the default content sync generator and lands under the manager tree', () => {
    expect(DEFAULT_CONTENT_GENERATOR_ID).toBe('claude-code');
    expect(MANAGER_CONTENT_OUTPUT).toBe('.revealui/content');
    expect(listGenerators()).toContain(DEFAULT_CONTENT_GENERATOR_ID);
    expect(getGenerator(DEFAULT_CONTENT_GENERATOR_ID)).toBeInstanceOf(ClaudeCodeGenerator);
  });

  it('declares its output directory under the project manager', () => {
    const generator = new ClaudeCodeGenerator();
    expect(generator.id).toBe(DEFAULT_CONTENT_GENERATOR_ID);
    expect(generator.outputDir).toBe(MANAGER_CONTENT_OUTPUT);
  });

  describe('generateRule', () => {
    it('writes markdown under .revealui/content/rules/', () => {
      const rule: Rule = {
        id: 'tracker-first',
        name: 'Tracker First',
        description: 'Open TRACKER first',
        scope: 'project',
        preambleTier: 1,
        tier: 'oss',
        tags: ['coordination'],
        content: '# Tracker First\n\nOpen docs/TRACKER.md first.\n',
      };
      const files = new ClaudeCodeGenerator().generateRule(rule, ctx);
      expect(files).toHaveLength(1);
      expect(files[0]?.relativePath).toBe('.revealui/content/rules/tracker-first.md');
      expect(files[0]?.content).toContain('Open docs/TRACKER.md first');
    });
  });

  describe('generateCommand', () => {
    it('writes frontmatter markdown under .revealui/content/commands/', () => {
      const cmd: Command = {
        id: 'gate',
        name: 'Gate',
        description: 'Run the quality gate',
        tier: 'oss',
        disableModelInvocation: false,
        content: 'Run lint, typecheck, and tests.',
      };
      const [file] = new ClaudeCodeGenerator().generateCommand(cmd, ctx);
      expect(file?.relativePath).toBe('.revealui/content/commands/gate.md');
      expect(file?.content).toContain('description: Run the quality gate');
      expect(file?.content).toContain('Run lint, typecheck, and tests.');
    });
  });

  describe('generateAgent', () => {
    it('writes frontmatter markdown under .revealui/content/agents/', () => {
      const agent: Agent = {
        id: 'reviewer',
        name: 'Reviewer',
        description: 'Reviews code',
        tier: 'oss',
        isolation: 'none',
        tools: ['Read', 'Grep'],
        content: 'You review code for quality.',
      };
      const [file] = new ClaudeCodeGenerator().generateAgent(agent, ctx);
      expect(file?.relativePath).toBe('.revealui/content/agents/reviewer.md');
      expect(file?.content).toContain('name: Reviewer');
      expect(file?.content).toContain('tools: Read, Grep');
    });
  });

  describe('generateSkill', () => {
    it('writes SKILL.md under .revealui/content/skills/<id>/', () => {
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
      const [file] = new ClaudeCodeGenerator().generateSkill(skill, ctx);
      expect(file?.relativePath).toBe('.revealui/content/skills/tdd/SKILL.md');
      expect(file?.content).toContain('name: TDD');
      expect(file?.content).toContain('Write tests first.');
    });
  });

  describe('generateAll', () => {
    it('emits all content under .revealui/content (manager tree)', () => {
      const manifest = buildManifest();
      const files = generateContent(DEFAULT_CONTENT_GENERATOR_ID, manifest, ctx);
      expect(files.length).toBeGreaterThan(0);
      expect(files.some((f) => f.relativePath === '.revealui/content/rules/tracker-first.md')).toBe(
        true,
      );
      expect(files.every((f) => f.relativePath.startsWith(`${MANAGER_CONTENT_OUTPUT}/`))).toBe(
        true,
      );
    });
  });
});
