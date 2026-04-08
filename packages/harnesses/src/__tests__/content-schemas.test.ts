import { describe, expect, it } from 'vitest';
import { buildManifest } from '../content/definitions/index.js';
import {
  AgentSchema,
  CommandSchema,
  ManifestSchema,
  PreambleTierSchema,
  RuleSchema,
  SkillSchema,
} from '../content/schemas/index.js';

describe('Content Schemas', () => {
  describe('RuleSchema', () => {
    it('validates a complete rule', () => {
      const result = RuleSchema.safeParse({
        id: 'test-rule',
        name: 'Test Rule',
        description: 'A test rule',
        scope: 'project',
        preambleTier: 2,
        tags: ['test'],
        content: '# Test\n\nContent here.',
      });
      expect(result.success).toBe(true);
    });

    it('applies defaults for optional fields', () => {
      const result = RuleSchema.parse({
        id: 'minimal',
        name: 'Minimal',
        description: 'Minimal rule',
        scope: 'global',
        content: 'Content',
      });
      expect(result.preambleTier).toBe(2);
      expect(result.tags).toEqual([]);
    });

    it('rejects invalid scope', () => {
      const result = RuleSchema.safeParse({
        id: 'bad',
        name: 'Bad',
        description: 'Bad scope',
        scope: 'invalid',
        content: 'Content',
      });
      expect(result.success).toBe(false);
    });

    it('rejects preamble tier out of range', () => {
      const result = RuleSchema.safeParse({
        id: 'bad',
        name: 'Bad',
        description: 'Bad tier',
        scope: 'project',
        preambleTier: 5,
        content: 'Content',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty id', () => {
      const result = RuleSchema.safeParse({
        id: '',
        name: 'Empty ID',
        description: 'desc',
        scope: 'project',
        content: 'Content',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('CommandSchema', () => {
    it('validates a complete command', () => {
      const result = CommandSchema.safeParse({
        id: 'test-cmd',
        name: 'Test Command',
        description: 'A test command',
        disableModelInvocation: true,
        argumentHint: '<name>',
        content: 'Do the thing.',
      });
      expect(result.success).toBe(true);
    });

    it('defaults disableModelInvocation to false', () => {
      const result = CommandSchema.parse({
        id: 'cmd',
        name: 'Cmd',
        description: 'desc',
        content: 'Content',
      });
      expect(result.disableModelInvocation).toBe(false);
    });
  });

  describe('AgentSchema', () => {
    it('validates an agent with worktree isolation', () => {
      const result = AgentSchema.safeParse({
        id: 'test-agent',
        name: 'Test Agent',
        description: 'A test agent',
        isolation: 'worktree',
        tools: ['Read', 'Edit'],
        content: 'You are a test agent.',
      });
      expect(result.success).toBe(true);
    });

    it('defaults isolation to none and tools to empty', () => {
      const result = AgentSchema.parse({
        id: 'agent',
        name: 'Agent',
        description: 'desc',
        content: 'Content',
      });
      expect(result.isolation).toBe('none');
      expect(result.tools).toEqual([]);
    });
  });

  describe('SkillSchema', () => {
    it('validates a skill with references', () => {
      const result = SkillSchema.safeParse({
        id: 'test-skill',
        name: 'Test Skill',
        description: 'A test skill',
        references: { gotchas: '# Gotchas\n\n- Item 1' },
        content: '# Skill content',
      });
      expect(result.success).toBe(true);
    });

    it('defaults all optional fields', () => {
      const result = SkillSchema.parse({
        id: 'skill',
        name: 'Skill',
        description: 'desc',
        content: 'Content',
      });
      expect(result.disableModelInvocation).toBe(false);
      expect(result.filePatterns).toEqual([]);
      expect(result.bashPatterns).toEqual([]);
      expect(result.references).toEqual({});
    });
  });

  describe('PreambleTierSchema', () => {
    it('validates a valid tier', () => {
      const result = PreambleTierSchema.safeParse({
        tier: 1,
        name: 'Identity',
        description: 'Core identity',
        ruleIds: ['monorepo'],
      });
      expect(result.success).toBe(true);
    });

    it('rejects tier 0', () => {
      const result = PreambleTierSchema.safeParse({
        tier: 0,
        name: 'Invalid',
        description: 'Too low',
        ruleIds: [],
      });
      expect(result.success).toBe(false);
    });

    it('rejects tier 5', () => {
      const result = PreambleTierSchema.safeParse({
        tier: 5,
        name: 'Invalid',
        description: 'Too high',
        ruleIds: [],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('ManifestSchema', () => {
    it('validates the full built manifest', () => {
      const manifest = buildManifest();
      const result = ManifestSchema.safeParse(manifest);
      expect(result.success).toBe(true);
    });

    it('rejects wrong version', () => {
      const result = ManifestSchema.safeParse({
        version: 2,
        generatedAt: new Date().toISOString(),
        rules: [],
        commands: [],
        agents: [],
        skills: [],
        preambles: [],
      });
      expect(result.success).toBe(false);
    });
  });
});
