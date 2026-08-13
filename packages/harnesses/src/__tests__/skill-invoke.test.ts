import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { SkillCatalogEntry } from '../content/skill-catalog.js';
import {
  buildSkillInvokeRequest,
  PHASE_C_INFERENCE_SNAP,
  resolveNativeWorkflowSkillId,
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
    expect(result.model).toBe('nemotron-3-nano');
    expect(result.system).toContain('# revealui-doctor body');
    expect(result.user).toContain('cannot execute tools');
  });
});
