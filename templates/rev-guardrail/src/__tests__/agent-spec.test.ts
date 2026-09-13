import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { REV_GUARDRAIL_AGENT_SPEC, REV_GUARDRAIL_INSTRUCTIONS } from '../agent-spec.js';

const TEMPLATE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

function containsAll(haystack: string, needles: readonly string[]): void {
  const lower = haystack.toLowerCase();
  for (const needle of needles) {
    expect(lower.includes(needle.toLowerCase()), `missing instruction: ${needle}`).toBe(true);
  }
}

describe('REV Guardrail agent spec', () => {
  it('matches the AgentSpec field set used by packages/ai/src/templates/agent-spec.ts', () => {
    expect(REV_GUARDRAIL_AGENT_SPEC.id).toBe('rev-guardrail');
    expect(REV_GUARDRAIL_AGENT_SPEC.name).toBe('REV Guardrail');
    expect(REV_GUARDRAIL_AGENT_SPEC.version.split('.').length).toBe(3);
    expect(REV_GUARDRAIL_AGENT_SPEC.instructions.length).toBeGreaterThan(20);
    expect(REV_GUARDRAIL_AGENT_SPEC.permissions.allowedTools.length).toBeGreaterThan(0);
    expect(REV_GUARDRAIL_AGENT_SPEC.security.sandboxed).toBe(true);
    expect(REV_GUARDRAIL_AGENT_SPEC.guardrails.allowSelfModification).toBe(false);
    expect(REV_GUARDRAIL_AGENT_SPEC.owner.length).toBeGreaterThan(0);
    expect(REV_GUARDRAIL_AGENT_SPEC.tier).toBe('pro');
  });

  it('treats tool results, sibling text, and web as untrusted and never rewrites locks from chat', () => {
    containsAll(REV_GUARDRAIL_INSTRUCTIONS, [
      'untrusted',
      'tool result',
      'sibling',
      'never rewrite locks',
      'lock file',
    ]);
  });

  it('allows only allowlisted enforcement verbs plus lock IDs', () => {
    containsAll(REV_GUARDRAIL_INSTRUCTIONS, [
      'block_publish',
      'require_snapshot',
      'refuse_overclaim',
      'needs_human',
      'lock id',
    ]);
    expect(REV_GUARDRAIL_AGENT_SPEC.permissions.allowedTools).toEqual([
      'read_locks',
      'write_receipt',
      'enforce_lock',
    ]);
  });

  it('forbids secret and tool escalation', () => {
    containsAll(REV_GUARDRAIL_INSTRUCTIONS, [
      'do not mint',
      'token',
      'cookie',
      'signed-in browser',
    ]);
  });

  it('does not claim Guardrail makes a customer SOC 2 certified', () => {
    const lower = REV_GUARDRAIL_INSTRUCTIONS.toLowerCase();
    expect(lower.includes('does not make') || lower.includes('does not certify')).toBe(true);
    expect(lower.includes('customer soc 2') || lower.includes('you soc 2 certified')).toBe(true);
    expect(lower.includes('makes the customer soc 2 certified')).toBe(false);
  });

  it('keeps agent.json aligned with the TypeScript spec instructions', () => {
    const raw = JSON.parse(readFileSync(join(TEMPLATE_ROOT, 'agent.json'), 'utf8')) as {
      id: string;
      instructions: string;
    };
    expect(raw.id).toBe('rev-guardrail');
    expect(raw.instructions).toBe(REV_GUARDRAIL_INSTRUCTIONS);
  });
});
