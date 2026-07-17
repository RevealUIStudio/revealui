import { describe, expect, it } from 'vitest';
import { VSCodeGenerator } from '../content/generators/vscode.js';
import { buildManifest, generateContent, getGenerator, listGenerators } from '../content/index.js';
import type { Agent, Command, Rule, Skill } from '../content/schemas/index.js';

const ctx = { projectRoot: '/test' };

describe('VSCodeGenerator', () => {
  it('is auto-registered in the content generator registry', () => {
    expect(listGenerators()).toContain('vscode');
    expect(getGenerator('vscode')).toBeInstanceOf(VSCodeGenerator);
  });

  it('declares its output directory', () => {
    const generator = new VSCodeGenerator();
    expect(generator.id).toBe('vscode');
    expect(generator.outputDir).toBe('.revealui/vscode-plugin');
  });

  describe('generateRule / generateCommand / generateAgent / generateSkill -- Phase C scope is plugin.json hooks only', () => {
    it('all four return no files', () => {
      const generator = new VSCodeGenerator();
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
    it('emits exactly one file: .revealui/vscode-plugin/plugin.json', () => {
      const manifest = buildManifest();
      const files = generateContent('vscode', manifest, ctx);
      expect(files).toHaveLength(1);
      expect(files[0]?.relativePath).toBe('.revealui/vscode-plugin/plugin.json');
    });

    it('every hook entry is command-based and invokes the harness CLI hook subcommand', () => {
      const manifest = buildManifest();
      const [file] = generateContent('vscode', manifest, ctx);
      const parsed = JSON.parse(file?.content ?? '{}') as {
        name: string;
        hooks: Record<string, Array<{ command: string; type: string }>>;
        mcpServers: string;
      };

      expect(parsed.name).toBe('revealui');
      const eventNames = Object.keys(parsed.hooks);
      expect(eventNames.length).toBeGreaterThan(0);

      for (const eventName of eventNames) {
        const entries = parsed.hooks[eventName] ?? [];
        expect(entries).toHaveLength(1);
        for (const entry of entries) {
          expect(entry.type).toBe('command');
          expect(entry.command).toBe('revealui-harnesses hook vscode');
        }
      }
    });

    it('covers every VS Code hook event the vscode normalizer maps (design doc §2.3)', () => {
      const manifest = buildManifest();
      const [file] = generateContent('vscode', manifest, ctx);
      const parsed = JSON.parse(file?.content ?? '{}') as { hooks: Record<string, unknown> };

      for (const eventName of [
        'SessionStart',
        'UserPromptSubmit',
        'PreToolUse',
        'PostToolUse',
        'PreCompact',
        'SubagentStart',
        'SubagentStop',
        'Stop',
      ]) {
        expect(parsed.hooks).toHaveProperty(eventName);
      }
    });

    it('references .mcp.json by path rather than inlining server/token content', () => {
      const manifest = buildManifest();
      const [file] = generateContent('vscode', manifest, ctx);
      const parsed = JSON.parse(file?.content ?? '{}') as { mcpServers: unknown };
      expect(parsed.mcpServers).toBe('.mcp.json');
    });

    // SECURITY / design invariant I-4: the plugin.json manifest itself is
    // generated with no MCP URL or token option at all (the ContentGenerator
    // interface's generateAll(manifest, ctx) carries neither) -- so it is
    // structurally incapable of leaking a token, not merely disciplined
    // about it. Assert that no plausible token-shaped string appears.
    it('I-4: the generated manifest never contains a token-shaped value', () => {
      const manifest = buildManifest();
      const [file] = generateContent('vscode', manifest, ctx);
      const content = file?.content ?? '';
      expect(content.includes('rvui_dev_')).toBe(false);
      expect(content.includes('Bearer ')).toBe(false);
    });
  });
});
