import { describe, expect, it } from 'vitest';
import { generateCursorRules } from '../cursor/index.js';

describe('generateCursorRules', () => {
  it('returns a non-empty string', () => {
    const rules = generateCursorRules();
    expect(typeof rules).toBe('string');
    expect(rules.length).toBeGreaterThan(0);
  });

  it('mentions RevealUI project context', () => {
    const rules = generateCursorRules();
    expect(rules).toContain('RevealUI');
  });

  it('lists key packages', () => {
    const rules = generateCursorRules();
    expect(rules).toContain('@revealui/core');
    expect(rules).toContain('@revealui/db');
    expect(rules).toContain('@revealui/auth');
    expect(rules).toContain('@revealui/contracts');
  });

  it('includes Biome rule and warns against other formatters', () => {
    const rules = generateCursorRules();
    expect(rules).toContain('Biome');
    // Rules mention Prettier/ESLint in a "do not add" context — not as recommendations
    expect(rules).toContain('do not add');
  });

  it('specifies pnpm as package manager', () => {
    const rules = generateCursorRules();
    expect(rules).toContain('pnpm');
  });

  it('mentions soft-delete convention', () => {
    const rules = generateCursorRules();
    expect(rules).toContain('deletedAt');
  });
});
