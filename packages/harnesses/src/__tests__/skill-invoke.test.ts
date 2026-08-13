import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { SkillCatalogEntry } from '../content/skill-catalog.js';
import {
  buildSkillInvokeRequest,
  classifySkillInvokeFailure,
  extractSkillInvokeText,
  extractSkillInvokeToolCalls,
  mapNativeToolsToCodingInclude,
  nativeWorkflowToolDefinitions,
  PHASE_C_INFERENCE_SNAP,
  parseNativeWorkflowTools,
  parseSkillInvokeTimeoutOverride,
  resolveNativeWorkflowSkillId,
  SKILL_INVOKE_DECODE_BUDGET_MS,
  SKILL_INVOKE_MAX_COMPLETION_TOKENS,
  SKILL_INVOKE_MIN_TIMEOUT_MS,
  SKILL_INVOKE_MS_PER_PROMPT_TOKEN,
  skillInvokeCompletionBody,
  skillInvokeTimeoutMs,
} from '../content/skill-invoke.js';

function entry(id: string, dir: string): SkillCatalogEntry {
  const path = join(dir, 'SKILL.md');
  writeFileSync(
    path,
    `---
name: ${id}
description: fixture
---
# ${id} body
`,
  );
  return { id, name: id, description: 'fixture', path, source: 'revskills' };
}

describe('skill invoke (GAP-293 Phase C)', () => {
  it('resolves aliases to native workflow ids', () => {
    expect(resolveNativeWorkflowSkillId('doctor')).toBe('revealui-doctor');
    expect(resolveNativeWorkflowSkillId('revealui-checkpoint')).toBe('revealui-checkpoint');
    expect(resolveNativeWorkflowSkillId('lint')).toBeNull();
  });

  it('rejects skills outside the native allowlist', () => {
    const result = buildSkillInvokeRequest('preflight', []);
    expect('error' in result).toBe(true);
    if ('error' in result) expect(result.error).toContain('allowlist');
  });

  it('binds the product default snap and does not claim execution', () => {
    const dir = mkdtempSync(join(tmpdir(), 'skill-inv-'));
    mkdirSync(dir, { recursive: true });
    const catalog = [entry('revealui-doctor', dir)];
    const result = buildSkillInvokeRequest('doctor', catalog);
    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.model).toBe(PHASE_C_INFERENCE_SNAP);
    expect(result.model).toBe('gemma3');
    expect(result.system).toContain('# revealui-doctor body');
    expect(result.allowedTools).toEqual([]);
    expect(result.user).toContain('cannot execute tools');
  });

  it('parses SKILL.md allowed-tools and puts them on the completion body', () => {
    const dir = mkdtempSync(join(tmpdir(), 'skill-tools-'));
    mkdirSync(dir, { recursive: true });
    const path = join(dir, 'SKILL.md');
    writeFileSync(
      path,
      `---
name: revealui-doctor
description: fixture
allowed-tools: Bash, Read, Glob, Grep
---
# body
`,
    );
    const result = buildSkillInvokeRequest('doctor', [
      { id: 'revealui-doctor', name: 'Doc', description: 'd', path, source: 'revskills' },
    ]);
    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.allowedTools).toEqual(['Bash', 'Read', 'Glob', 'Grep']);
    expect(result.user).toContain('Use the provided tools');
    const body = skillInvokeCompletionBody(
      [
        { role: 'system', content: result.system },
        { role: 'user', content: result.user },
      ],
      result.allowedTools,
    );
    expect(body.max_tokens).toBe(SKILL_INVOKE_MAX_COMPLETION_TOKENS);
    expect(body.tool_choice).toBe('auto');
    expect(body.tools?.map((t) => t.function.name)).toEqual(['Bash', 'Read', 'Glob', 'Grep']);
  });

  it('extracts OpenAI tool_calls and drops unknown tool names from the allowlist parser', () => {
    expect(mapNativeToolsToCodingInclude(['Read', 'Bash'])).toEqual(['file_read', 'shell_exec']);
    expect(parseNativeWorkflowTools(['Read', 'Write', 'Bash', 'Read'])).toEqual(['Read', 'Bash']);
    expect(nativeWorkflowToolDefinitions(['Read']).length).toBe(1);
    expect(
      extractSkillInvokeToolCalls({
        choices: [
          {
            message: {
              content: '',
              tool_calls: [
                {
                  id: 'c1',
                  type: 'function',
                  function: { name: 'Read', arguments: '{"path":"a"}' },
                },
              ],
            },
          },
        ],
      }),
    ).toEqual([{ id: 'c1', name: 'Read', arguments: '{"path":"a"}' }]);
  });

  it('prefers message.content and falls back to reasoning_content', () => {
    expect(
      extractSkillInvokeText({
        choices: [{ message: { content: 'report', reasoning_content: 'think' } }],
      }),
    ).toBe('report');
    expect(
      extractSkillInvokeText({
        choices: [{ message: { content: '  ', reasoning_content: 'think' } }],
      }),
    ).toBe('think');
    expect(extractSkillInvokeText({ choices: [{ message: {} }] })).toBe('');
  });

  it('sizes timeout from prompt length and honors a positive override', () => {
    const system = 'x'.repeat(4000);
    const user = 'y'.repeat(200);
    const tokens = Math.ceil((system.length + user.length) / 4);
    expect(skillInvokeTimeoutMs(system, user)).toBe(
      tokens * SKILL_INVOKE_MS_PER_PROMPT_TOKEN + SKILL_INVOKE_DECODE_BUDGET_MS,
    );
    expect(skillInvokeTimeoutMs('', '')).toBe(SKILL_INVOKE_MIN_TIMEOUT_MS);
    expect(skillInvokeTimeoutMs(system, user, 90_000)).toBe(90_000);
    expect(parseSkillInvokeTimeoutOverride('45000')).toBe(45_000);
    expect(parseSkillInvokeTimeoutOverride('nope')).toBeNull();
  });

  it('classifies timeout vs connect failures', () => {
    const timeout = new Error('The operation was aborted due to timeout');
    timeout.name = 'TimeoutError';
    expect(classifySkillInvokeFailure(timeout)).toBe('timeout');
    expect(classifySkillInvokeFailure(new Error('fetch failed'))).toBe('connect');
    expect(classifySkillInvokeFailure(new Error('boom'))).toBe('other');
  });
});
