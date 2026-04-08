/**
 * Vercel Skills Integration Tests
 *
 * Tests for the Vercel Skills ecosystem integration.
 */

import { describe, expect, it } from 'vitest';
import { mapRevealUIToolsToVercel, mapVercelToolsToRevealUI } from '../compat/tool-mapper.js';
import { checkVercelCompatibility, normalizeVercelSkill } from '../compat/vercel-compat.js';
import { parseVercelSource } from '../loader/vercel-types.js';
import type { Skill } from '../types.js';

describe('Vercel Source Parsing', () => {
  it('should parse owner/repo format', () => {
    const source = parseVercelSource('vercel-labs/agent-skills');
    expect(source).toEqual({
      owner: 'vercel-labs',
      repo: 'agent-skills',
    });
  });

  it('should parse owner/repo/path format', () => {
    const source = parseVercelSource('vercel-labs/agent-skills/skills/react-best-practices');
    expect(source).toEqual({
      owner: 'vercel-labs',
      repo: 'agent-skills',
      path: 'skills/react-best-practices',
    });
  });

  it('should parse with ref', () => {
    const source = parseVercelSource('vercel-labs/agent-skills@main');
    expect(source).toEqual({
      owner: 'vercel-labs',
      repo: 'agent-skills',
      ref: 'main',
    });
  });

  it('should parse path with ref', () => {
    const source = parseVercelSource('vercel-labs/agent-skills/skills/react-best-practices@v1.0.0');
    expect(source).toEqual({
      owner: 'vercel-labs',
      repo: 'agent-skills',
      path: 'skills/react-best-practices',
      ref: 'v1.0.0',
    });
  });

  it('should throw on invalid format', () => {
    expect(() => parseVercelSource('invalid')).toThrow();
  });
});

describe('Vercel Compatibility', () => {
  it('should accept universal compatibility', () => {
    const skill: Skill = {
      metadata: {
        name: 'test-skill',
        description: 'Test skill',
        compatibility: ['universal'],
      },
      instructions: 'Test instructions',
      sourcePath: '/test',
      scope: 'local',
    };

    const result = checkVercelCompatibility(skill);
    expect(result).toBe(true);
  });

  it('should accept claude-code compatibility', () => {
    const skill: Skill = {
      metadata: {
        name: 'test-skill',
        description: 'Test skill',
        compatibility: ['claude-code'],
      },
      instructions: 'Test instructions',
      sourcePath: '/test',
      scope: 'local',
    };

    const result = checkVercelCompatibility(skill);
    expect(result).toBe(true);
  });

  it('should normalize skill with missing compatibility', () => {
    const skill: Skill = {
      metadata: {
        name: 'test-skill',
        description: 'Test skill',
      },
      instructions: 'Test instructions',
      sourcePath: '/test',
      scope: 'local',
    };

    const normalized = normalizeVercelSkill(skill);
    expect(normalized.metadata.compatibility).toContain('universal');
  });
});

describe('Tool Name Mapping', () => {
  it('should map Vercel tools to RevealUI', () => {
    const vercelTools = ['bash', 'read', 'write', 'edit'];
    const mapped = mapVercelToolsToRevealUI(vercelTools);
    expect(mapped).toEqual(['Bash', 'Read', 'Write', 'Edit']);
  });

  it('should map RevealUI tools to Vercel', () => {
    const revealuiTools = ['Bash', 'Read', 'Write', 'Edit'];
    const mapped = mapRevealUIToolsToVercel(revealuiTools);
    expect(mapped).toEqual(['bash', 'read', 'write', 'edit']);
  });

  it('should preserve tool filters', () => {
    const vercelTools = ['bash(git:*)'];
    const mapped = mapVercelToolsToRevealUI(vercelTools);
    expect(mapped).toEqual(['Bash(git:*)']);
  });

  it('should handle web-fetch mapping', () => {
    const vercelTools = ['web-fetch', 'web-search'];
    const mapped = mapVercelToolsToRevealUI(vercelTools);
    expect(mapped).toEqual(['WebFetch', 'WebSearch']);
  });
});
