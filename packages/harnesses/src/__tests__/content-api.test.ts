import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildManifest,
  generateContent,
  listContent,
  validateManifest,
  writeCanonicalDefinition,
  writeRuleProfileExports,
} from '../content/index.js';

describe('Content Public API', () => {
  describe('buildManifest', () => {
    it('returns a manifest with all content types', () => {
      const manifest = buildManifest();
      expect(manifest.version).toBe(1);
      expect(manifest.generatedAt).toBeTruthy();
      expect(manifest.rules.length).toBe(21);
      expect(manifest.commands.length).toBe(4);
      expect(manifest.agents.length).toBe(6);
      expect(manifest.skills.length).toBe(10);
      expect(manifest.preambles.length).toBe(4);
    });
  });

  describe('validateManifest', () => {
    it('accepts a valid manifest', () => {
      const manifest = buildManifest();
      const result = validateManifest(manifest);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('rejects an empty object', () => {
      const result = validateManifest({});
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects null', () => {
      const result = validateManifest(null);
      expect(result.valid).toBe(false);
    });
  });

  describe('generateContent', () => {
    it('rejects retired fleet values after resolving project content', () => {
      const manifest = buildManifest();
      manifest.rules[0]!.content = 'Project: {{PROJECT_NAME}}';
      const projectName = ['rev', 'fleet'].join('');
      expect(() =>
        generateContent('claude-code', manifest, { projectRoot: '/test', projectName }),
      ).toThrow('Generated fleet content must use revealfleet and REVEALFLEET.');
      expect(() =>
        generateContent('claude-code', manifest, {
          projectRoot: '/test',
          projectName: 'revealfleet',
        }),
      ).not.toThrow();
    });
    it('throws for unknown generator', () => {
      const manifest = buildManifest();
      expect(() => generateContent('nonexistent', manifest, { projectRoot: '/test' })).toThrow(
        'Unknown generator "nonexistent"',
      );
    });
  });

  describe('listContent', () => {
    it('returns correct counts', () => {
      const summary = listContent();
      expect(summary.rules).toBe(21);
      expect(summary.commands).toBe(4);
      expect(summary.agents).toBe(6);
      expect(summary.skills).toBe(10);
      expect(summary.preambles).toBe(4);
      expect(summary.total).toBe(41);
    });

    it('accepts an explicit manifest', () => {
      const manifest = buildManifest();
      const summary = listContent(manifest);
      expect(summary.total).toBe(41);
    });
  });

  describe('Definitions integrity', () => {
    it('all rule IDs are unique', () => {
      const manifest = buildManifest();
      const ids = manifest.rules.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('all command IDs are unique', () => {
      const manifest = buildManifest();
      const ids = manifest.commands.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('all agent IDs are unique', () => {
      const manifest = buildManifest();
      const ids = manifest.agents.map((a) => a.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('all skill IDs are unique', () => {
      const manifest = buildManifest();
      const ids = manifest.skills.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('preamble rule references exist in manifest', () => {
      const manifest = buildManifest();
      const ruleIds = new Set(manifest.rules.map((r) => r.id));
      for (const preamble of manifest.preambles) {
        for (const ruleId of preamble.ruleIds) {
          expect(ruleIds.has(ruleId)).toBe(true);
        }
      }
    });

    it('preamble tiers cover 1-4 without gaps', () => {
      const manifest = buildManifest();
      const tiers = manifest.preambles.map((p) => p.tier).sort();
      expect(tiers).toEqual([1, 2, 3, 4]);
    });

    it('every rule is assigned to exactly one preamble tier', () => {
      const manifest = buildManifest();
      const assignedRuleIds = manifest.preambles.flatMap((p) => p.ruleIds);
      const ruleIds = manifest.rules.map((r) => r.id);
      expect(new Set(assignedRuleIds).size).toBe(assignedRuleIds.length);
      expect(assignedRuleIds.sort()).toEqual(ruleIds.sort());
    });
  });
});

describe('canonical profile rule export', () => {
  const roots: string[] = [];
  const root = () => {
    const directory = mkdtempSync(join(tmpdir(), 'canonical-rule-export-'));
    roots.push(directory);
    return directory;
  };
  afterEach(() => {
    for (const directory of roots.splice(0)) rmSync(directory, { recursive: true, force: true });
  });
  it('exports only selected rules and preserves adapted profile rules', () => {
    const directory = root();
    writeFileSync(join(directory, 'agent-dispatch.md'), 'adapted routing');
    const manifest = buildManifest();
    expect(writeRuleProfileExports(manifest, [directory], ['durable-solutions'])).toBe(1);
    expect(readFileSync(join(directory, 'durable-solutions.md'), 'utf8')).toBe(
      manifest.rules.find((rule) => rule.id === 'durable-solutions')!.content,
    );
    expect(readFileSync(join(directory, 'agent-dispatch.md'), 'utf8')).toBe('adapted routing');
  });
  it('rejects unknown selections and symlink destinations before any writes', () => {
    const directory = root();
    const protectedFile = join(root(), 'protected.md');
    writeFileSync(protectedFile, 'owner content');
    symlinkSync(protectedFile, join(directory, 'quality-over-speed.md'));
    expect(() =>
      writeRuleProfileExports(buildManifest(), [directory], ['durable-solutions', 'unknown-rule']),
    ).toThrow('Unknown canonical rule');
    expect(() =>
      writeRuleProfileExports(
        buildManifest(),
        [directory],
        ['durable-solutions', 'quality-over-speed'],
      ),
    ).toThrow('regular file');
    expect(() => readFileSync(join(directory, 'durable-solutions.md'))).toThrow();
    expect(readFileSync(protectedFile, 'utf8')).toBe('owner content');
  });
  it('removes an obsolete tier copy through canonical export', () => {
    const directory = root();
    mkdirSync(join(directory, 'rules/pro'), { recursive: true });
    writeFileSync(join(directory, 'rules/pro/durable-solutions.md'), 'obsolete rule');
    writeCanonicalDefinition(directory, 'rules', {
      id: 'durable-solutions',
      tier: 'oss',
      content: 'canonical rule',
    });
    expect(readFileSync(join(directory, 'rules/oss/durable-solutions.md'), 'utf8')).toBe(
      'canonical rule',
    );
    expect(() => readFileSync(join(directory, 'rules/pro/durable-solutions.md'))).toThrow();
  });

  it('enforces root-cause-only policy in canonical definitions', () => {
    const manifest = buildManifest();
    const durable = manifest.rules.find((rule) => rule.id === 'durable-solutions')!.content;
    const quality = manifest.rules.find((rule) => rule.id === 'quality-over-speed')!.content;
    expect(durable).toContain('registry entry does not make them acceptable fixes');
    expect(durable).toContain('never authorizes a new one-off');
    expect(durable).not.toContain('hotfix register');
    expect(quality).toContain('never ship one-offs or registry-backed exceptions');
  });
});
