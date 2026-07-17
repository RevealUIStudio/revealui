import { describe, expect, it } from 'vitest';
import { CursorGenerator } from '../content/generators/cursor.js';
import { buildManifest, generateContent, getGenerator, listGenerators } from '../content/index.js';
import type { Agent, Command, Rule, Skill } from '../content/schemas/index.js';

const ctx = { projectRoot: '/test' };

describe('CursorGenerator', () => {
  it('is auto-registered in the content generator registry', () => {
    expect(listGenerators()).toContain('cursor');
    expect(getGenerator('cursor')).toBeInstanceOf(CursorGenerator);
  });

  it('declares its output directory', () => {
    const generator = new CursorGenerator();
    expect(generator.id).toBe('cursor');
    expect(generator.outputDir).toBe('.cursor');
  });

  describe('generateRule / generateCommand / generateAgent / generateSkill -- Phase B scope is hooks.json only', () => {
    it('all four return no files', () => {
      const generator = new CursorGenerator();
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
      const cmd: Command = {
        id: 'gate',
        name: 'Gate',
        description: 'Run the quality gate',
        tier: 'oss',
        disableModelInvocation: false,
        content: 'Run lint, typecheck, and tests.',
      };
      const agent: Agent = {
        id: 'reviewer',
        name: 'Reviewer',
        description: 'Reviews code',
        tier: 'oss',
        isolation: 'none',
        tools: ['Read'],
        content: 'You review code.',
      };
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

      expect(generator.generateRule(rule, ctx)).toEqual([]);
      expect(generator.generateCommand(cmd, ctx)).toEqual([]);
      expect(generator.generateAgent(agent, ctx)).toEqual([]);
      expect(generator.generateSkill(skill, ctx)).toEqual([]);
    });
  });

  describe('generateAll', () => {
    it('emits exactly one file: .cursor/hooks.json', () => {
      const manifest = buildManifest();
      const files = generateContent('cursor', manifest, ctx);
      expect(files).toHaveLength(1);
      expect(files[0]?.relativePath).toBe('.cursor/hooks.json');
    });

    it('every hook entry is command-based and invokes the harness CLI hook subcommand', () => {
      const manifest = buildManifest();
      const [file] = generateContent('cursor', manifest, ctx);
      const config = JSON.parse(file?.content ?? '{}') as {
        version: number;
        hooks: Record<string, Array<{ command: string; type: string }>>;
      };

      expect(config.version).toBe(1);
      const eventNames = Object.keys(config.hooks);
      expect(eventNames.length).toBeGreaterThan(0);

      for (const eventName of eventNames) {
        const entries = config.hooks[eventName] ?? [];
        expect(entries).toHaveLength(1);
        for (const entry of entries) {
          expect(entry.type).toBe('command');
          expect(entry.command).toBe('revealui-harnesses hook cursor');
        }
      }
    });

    it('covers every event the cursor normalizer maps (design doc §2.3)', () => {
      const manifest = buildManifest();
      const [file] = generateContent('cursor', manifest, ctx);
      const config = JSON.parse(file?.content ?? '{}') as { hooks: Record<string, unknown> };

      for (const eventName of [
        'sessionStart',
        'sessionEnd',
        'preToolUse',
        'postToolUse',
        'beforeShellExecution',
        'afterShellExecution',
        'beforeMCPExecution',
        'afterMCPExecution',
        'beforeReadFile',
        'afterFileEdit',
        'stop',
      ]) {
        expect(config.hooks).toHaveProperty(eventName);
      }
    });
  });
});
