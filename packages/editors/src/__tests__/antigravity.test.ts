import { describe, expect, it } from 'vitest';
import { generateAntigravityRules } from '../antigravity/index.js';

describe('generateAntigravityRules', () => {
  it('returns a non-empty string', () => {
    const rules = generateAntigravityRules();
    expect(typeof rules).toBe('string');
    expect(rules.length).toBeGreaterThan(0);
  });

  it('mentions RevealUI project context', () => {
    const rules = generateAntigravityRules();
    expect(rules).toContain('RevealUI');
  });

  it('lists key packages', () => {
    const rules = generateAntigravityRules();
    expect(rules).toContain('@revealui/core');
    expect(rules).toContain('@revealui/db');
    expect(rules).toContain('@revealui/auth');
    expect(rules).toContain('@revealui/contracts');
  });

  it('includes agent-specific gate commands', () => {
    const rules = generateAntigravityRules();
    expect(rules).toContain('gate:quick');
    expect(rules).toContain('typecheck');
  });

  it('specifies the dual-DB boundary rule', () => {
    const rules = generateAntigravityRules();
    expect(rules).toContain('NeonDB');
    expect(rules).toContain('Supabase');
    expect(rules).toContain('@supabase/supabase-js');
  });

  it('mentions soft-delete convention', () => {
    const rules = generateAntigravityRules();
    expect(rules).toContain('deletedAt');
  });
});
