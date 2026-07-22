import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  checkManager,
  loadManager,
  ManagerSchema,
  materializeManager,
  writeManager,
} from '../manager/index.js';

describe('project manager (.revealui)', () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const d of dirs) {
      rmSync(d, { recursive: true, force: true });
    }
    dirs.length = 0;
  });

  function tempProject(): string {
    const d = mkdtempSync(join(tmpdir(), 'revealui-manager-'));
    dirs.push(d);
    return d;
  }

  it('parses default manager config', () => {
    const cfg = ManagerSchema.parse({});
    expect(cfg.version).toBe(1);
    expect(cfg.contentRoot).toBe('content');
    expect(cfg.adapters.some((a) => a.id === 'claude-code' && a.rank === 'equal')).toBe(true);
    expect(cfg.adapters.every((a) => a.rank === 'equal')).toBe(true);
  });

  it('materialize writes manager.json and equal adapter stubs', () => {
    const root = tempProject();
    const result = materializeManager(root);
    expect(result.managerPath).toContain('.revealui/manager.json');
    const cfg = loadManager(root);
    expect(cfg.version).toBe(1);
    const stub = readFileSync(join(root, '.claude/rules/00-revealui-manager.md'), 'utf-8');
    expect(stub).toContain('.revealui/manager.json');
    expect(stub).toContain('equal');
    expect(result.stubs.length).toBeGreaterThanOrEqual(3);
  });

  it('check fails without manager and passes after write', () => {
    const root = tempProject();
    expect(checkManager(root).ok).toBe(false);
    writeManager(root);
    const after = checkManager(root);
    expect(after.ok).toBe(true);
  });
});
