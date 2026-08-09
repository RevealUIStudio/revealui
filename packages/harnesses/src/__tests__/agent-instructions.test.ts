import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildAgentInstructions,
  DEFAULT_AGENT_RULES_MAX_CHARS,
  shouldIncludeAgentRules,
} from '../adapters/agent-instructions.js';

const prevEnv = process.env.REVEALUI_AGENT_INCLUDE_RULES;

afterEach(() => {
  if (prevEnv === undefined) {
    delete process.env.REVEALUI_AGENT_INCLUDE_RULES;
  } else {
    process.env.REVEALUI_AGENT_INCLUDE_RULES = prevEnv;
  }
});

describe('buildAgentInstructions', () => {
  it('defaults to slim instructions without dumping rules', () => {
    delete process.env.REVEALUI_AGENT_INCLUDE_RULES;
    const root = mkdtempSync(join(tmpdir(), 'agent-instr-'));
    mkdirSync(join(root, '.claude', 'rules'), { recursive: true });
    writeFileSync(join(root, '.claude', 'rules', 'huge.md'), `${'x'.repeat(20_000)}\n`);

    const text = buildAgentInstructions({ projectRoot: root });
    expect(text.length).toBeLessThan(2_000);
    expect(text).toContain('RevealUI coding agent');
    expect(text).not.toContain('huge');
  });

  it('caps rules when includeRules is enabled', () => {
    const root = mkdtempSync(join(tmpdir(), 'agent-instr-'));
    mkdirSync(join(root, '.claude', 'rules'), { recursive: true });
    writeFileSync(join(root, '.claude', 'rules', 'a.md'), `${'a'.repeat(10_000)}\n`);

    const text = buildAgentInstructions({
      projectRoot: root,
      includeRules: true,
      maxRulesChars: 500,
    });
    expect(text).toContain('Project rules');
    expect(text.length).toBeLessThan(BASE_PLUS_CAP);
    expect(text).toMatch(/truncated|omitted/i);
  });

  it('shouldIncludeAgentRules reads env', () => {
    delete process.env.REVEALUI_AGENT_INCLUDE_RULES;
    expect(shouldIncludeAgentRules()).toBe(false);
    process.env.REVEALUI_AGENT_INCLUDE_RULES = '1';
    expect(shouldIncludeAgentRules()).toBe(true);
    expect(shouldIncludeAgentRules(false)).toBe(false);
  });
});

/** base ~400 + cap 500 + headers */
const BASE_PLUS_CAP = 2_000 + DEFAULT_AGENT_RULES_MAX_CHARS;
