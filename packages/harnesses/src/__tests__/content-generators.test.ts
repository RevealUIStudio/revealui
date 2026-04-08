import { describe, expect, it } from 'vitest';
import { ClaudeCodeGenerator } from '../content/generators/claude.js';
import { CursorGenerator } from '../content/generators/cursor.js';
import { getGenerator, listGenerators } from '../content/generators/index.js';
import type { ResolverContext } from '../content/resolvers/types.js';
import type { Agent, Command, Rule, Skill } from '../content/schemas/index.js';

const ctx: ResolverContext = { projectRoot: '/test' };

const sampleRule: Rule = {
  id: 'test-rule',
  name: 'Test Rule',
  description: 'A test rule',
  scope: 'project',
  preambleTier: 2,
  tags: ['test'],
  content: '# Test Rule\n\nThis is content with {{PROJECT_NAME}}.',
};

const sampleCommand: Command = {
  id: 'test-cmd',
  name: 'Test Command',
  description: 'A test command description',
  disableModelInvocation: true,
  argumentHint: '<name>',
  content: 'Run the test command.',
};

const sampleAgent: Agent = {
  id: 'test-agent',
  name: 'Test Agent',
  description: 'Runs tests in isolation',
  isolation: 'worktree',
  tools: [],
  content: 'You are a test agent.',
};

const sampleSkill: Skill = {
  id: 'test-skill',
  name: 'Test Skill',
  description: 'A test skill',
  disableModelInvocation: false,
  filePatterns: [],
  bashPatterns: [],
  references: { gotchas: '# Gotchas\n\n- Watch out' },
  content: '# Test Skill\n\nSkill content.',
};

describe('Claude Code Generator', () => {
  const generator = new ClaudeCodeGenerator();

  it('has correct id and outputDir', () => {
    expect(generator.id).toBe('claude-code');
    expect(generator.outputDir).toBe('.claude');
  });

  describe('generateRule', () => {
    it('produces a single file at the correct path', () => {
      const files = generator.generateRule(sampleRule, ctx);
      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe('.claude/rules/test-rule.md');
    });

    it('resolves placeholders in content', () => {
      const files = generator.generateRule(sampleRule, ctx);
      expect(files[0].content).toContain('RevealUI');
      expect(files[0].content).not.toContain('{{PROJECT_NAME}}');
    });

    it('does not add frontmatter to rules', () => {
      const files = generator.generateRule(sampleRule, ctx);
      expect(files[0].content).not.toContain('---');
    });
  });

  describe('generateCommand', () => {
    it('produces YAML frontmatter with description', () => {
      const files = generator.generateCommand(sampleCommand, ctx);
      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe('.claude/commands/test-cmd.md');
      expect(files[0].content).toContain('---');
      expect(files[0].content).toContain('description: A test command description');
    });

    it('includes disable-model-invocation when true', () => {
      const files = generator.generateCommand(sampleCommand, ctx);
      expect(files[0].content).toContain('disable-model-invocation: true');
    });

    it('includes argument-hint', () => {
      const files = generator.generateCommand(sampleCommand, ctx);
      expect(files[0].content).toContain('argument-hint: <name>');
    });

    it('omits disable-model-invocation when false', () => {
      const cmd: Command = { ...sampleCommand, disableModelInvocation: false };
      const files = generator.generateCommand(cmd, ctx);
      expect(files[0].content).not.toContain('disable-model-invocation');
    });
  });

  describe('generateAgent', () => {
    it('produces YAML frontmatter with name and isolation', () => {
      const files = generator.generateAgent(sampleAgent, ctx);
      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe('.claude/agents/test-agent.md');
      expect(files[0].content).toContain('name: test-agent');
      expect(files[0].content).toContain('isolation: worktree');
    });

    it('omits isolation frontmatter when none', () => {
      const agent: Agent = {
        ...sampleAgent,
        isolation: 'none',
        description: 'A no-worktree agent',
      };
      const files = generator.generateAgent(agent, ctx);
      expect(files[0].content).not.toContain('isolation:');
    });
  });

  describe('generateSkill', () => {
    it('produces SKILL.md and reference files', () => {
      const files = generator.generateSkill(sampleSkill, ctx);
      expect(files).toHaveLength(2);
      expect(files[0].relativePath).toBe('.claude/skills/test-skill/SKILL.md');
      expect(files[1].relativePath).toBe('.claude/skills/test-skill/references/gotchas.md');
    });

    it('includes frontmatter in SKILL.md', () => {
      const files = generator.generateSkill(sampleSkill, ctx);
      expect(files[0].content).toContain('name: test-skill');
      expect(files[0].content).toContain('description: A test skill');
    });

    it('generates no reference files when references is empty', () => {
      const skill: Skill = { ...sampleSkill, references: {} };
      const files = generator.generateSkill(skill, ctx);
      expect(files).toHaveLength(1);
    });
  });

  describe('generateAll', () => {
    it('produces files for all content types', async () => {
      const { buildManifest } = await import('../content/definitions/index.js');
      const manifest = buildManifest();
      const files = generator.generateAll(manifest, ctx);
      expect(files.length).toBeGreaterThan(20);

      const paths = files.map((f) => f.relativePath);
      expect(paths.some((p) => p.startsWith('.claude/rules/'))).toBe(true);
      expect(paths.some((p) => p.startsWith('.claude/commands/'))).toBe(true);
      expect(paths.some((p) => p.startsWith('.claude/agents/'))).toBe(true);
      expect(paths.some((p) => p.startsWith('.claude/skills/'))).toBe(true);
    });
  });
});

describe('Cursor Generator', () => {
  const generator = new CursorGenerator();

  it('has correct id and outputDir', () => {
    expect(generator.id).toBe('cursor');
    expect(generator.outputDir).toBe('.cursor');
  });

  it('generates .mdc files for rules', () => {
    const files = generator.generateRule(sampleRule, ctx);
    expect(files).toHaveLength(1);
    expect(files[0].relativePath).toBe('.cursor/rules/test-rule.mdc');
    expect(files[0].content).toContain('description: A test rule');
  });

  it('returns empty for commands (no Cursor equivalent)', () => {
    expect(generator.generateCommand(sampleCommand, ctx)).toEqual([]);
  });

  it('returns empty for agents (no Cursor equivalent)', () => {
    expect(generator.generateAgent(sampleAgent, ctx)).toEqual([]);
  });

  it('returns empty for skills (no Cursor equivalent)', () => {
    expect(generator.generateSkill(sampleSkill, ctx)).toEqual([]);
  });
});

describe('Generator Registry', () => {
  it('lists both built-in generators', () => {
    const ids = listGenerators();
    expect(ids).toContain('claude-code');
    expect(ids).toContain('cursor');
  });

  it('retrieves generators by id', () => {
    expect(getGenerator('claude-code')).toBeInstanceOf(ClaudeCodeGenerator);
    expect(getGenerator('cursor')).toBeInstanceOf(CursorGenerator);
  });

  it('returns undefined for unknown id', () => {
    expect(getGenerator('nonexistent')).toBeUndefined();
  });
});
