import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { OMARCHY_AGENT_SPEC, OMARCHY_INSTRUCTIONS } from '../agent-spec.js';

const TEMPLATE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

function containsAll(haystack: string, needles: readonly string[]): void {
  const lower = haystack.toLowerCase();
  for (const needle of needles) {
    expect(lower.includes(needle.toLowerCase()), `missing instruction: ${needle}`).toBe(true);
  }
}

describe('Omarchy agent spec', () => {
  it('matches the AgentSpec field set used by packages/ai/src/templates/agent-spec.ts', () => {
    expect(OMARCHY_AGENT_SPEC.id).toBe('omarchy');
    expect(OMARCHY_AGENT_SPEC.name).toBe('Omarchy');
    expect(OMARCHY_AGENT_SPEC.version.split('.').length).toBe(3);
    expect(OMARCHY_AGENT_SPEC.instructions.length).toBeGreaterThan(20);
    expect(OMARCHY_AGENT_SPEC.permissions.allowedTools.length).toBeGreaterThan(0);
    expect(OMARCHY_AGENT_SPEC.security.sandboxed).toBe(true);
    expect(OMARCHY_AGENT_SPEC.guardrails.allowSelfModification).toBe(false);
    expect(OMARCHY_AGENT_SPEC.owner.length).toBeGreaterThan(0);
    expect(OMARCHY_AGENT_SPEC.tier).toBe('free');
  });

  it('points inference at OpenAI-compatible or Ollama and forbids Arch snap reimplementation', () => {
    containsAll(OMARCHY_INSTRUCTIONS, [
      'openai-compatible',
      'ollama',
      'do not reimplement',
      'snaps on arch',
    ]);
  });

  it('refuses exclusivity and a fourth SKU', () => {
    containsAll(OMARCHY_INSTRUCTIONS, [
      'never claim omarchy is required',
      'never claim exclusivity',
      'fourth public price sku',
      'ubuntu, wsl, and macos',
    ]);
  });

  it('allows only allowlisted install verbs', () => {
    containsAll(OMARCHY_INSTRUCTIONS, [
      'explain_install',
      'point_inference',
      'remind_stream_safe',
      'needs_human',
    ]);
    expect(OMARCHY_AGENT_SPEC.permissions.allowedTools).toEqual([
      'read_runtime',
      'explain_install',
      'point_inference',
    ]);
  });

  it('forbids secret and tool escalation', () => {
    containsAll(OMARCHY_INSTRUCTIONS, ['do not mint', 'token', 'cookie', 'signed-in browser']);
  });

  it('keeps agent.json aligned with the TypeScript spec instructions', () => {
    const raw = JSON.parse(readFileSync(join(TEMPLATE_ROOT, 'agent.json'), 'utf8')) as {
      id: string;
      instructions: string;
    };
    expect(raw.id).toBe('omarchy');
    expect(raw.instructions).toBe(OMARCHY_INSTRUCTIONS);
  });
});
