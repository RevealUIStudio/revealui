import { describe, expect, it } from 'vitest';
import { buildManifest, generateContent, listContent, validateManifest } from '../content/index.js';

describe('Content Public API', () => {
  describe('buildManifest', () => {
    it('returns a manifest with all content types', () => {
      const manifest = buildManifest();
      expect(manifest.version).toBe(1);
      expect(manifest.generatedAt).toBeTruthy();
      expect(manifest.rules.length).toBe(9);
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
      expect(summary.rules).toBe(9);
      expect(summary.commands).toBe(4);
      expect(summary.agents).toBe(6);
      expect(summary.skills).toBe(10);
      expect(summary.preambles).toBe(4);
      expect(summary.total).toBe(29);
    });

    it('accepts an explicit manifest', () => {
      const manifest = buildManifest();
      const summary = listContent(manifest);
      expect(summary.total).toBe(29);
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
