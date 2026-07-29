import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { MANAGER_MATERIALIZE_GENERATORS, writeManagerAdapterContent } from '../content/index.js';
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
    const cursorStub = readFileSync(join(root, '.cursor/revealui-manager.md'), 'utf-8');
    expect(cursorStub).toContain('.revealui/content/');
    expect(cursorStub).toContain('Equal');
    const opencodeStub = readFileSync(join(root, '.opencode/revealui-manager.md'), 'utf-8');
    expect(opencodeStub).toContain('.revealui/manager.json');
    expect(opencodeStub).toContain('equal');
  });

  it('materialize emits Grok peer SessionStart/SessionEnd control-layer hooks', () => {
    const root = tempProject();
    materializeManager(root);
    const grokMd = readFileSync(join(root, '.revealui/adapters/grok.md'), 'utf-8');
    expect(grokMd).toContain('session-start.json');
    expect(grokMd).toContain('hotfix-check');
    expect(grokMd).toContain('Do not invent a second hotfix registry');

    const start = JSON.parse(
      readFileSync(join(root, '.revealui/adapters/grok/hooks/session-start.json'), 'utf-8'),
    ) as { hooks: { SessionStart: Array<{ hooks: Array<{ command: string }> }> } };
    const startCmds = start.hooks.SessionStart.flatMap((g) => g.hooks.map((h) => h.command));
    expect(startCmds.some((c) => c.includes('tracker-session-check.js'))).toBe(true);
    expect(startCmds.some((c) => c.includes('hotfix-check.js'))).toBe(true);
    expect(startCmds.some((c) => c.includes('tmpscript-check.js'))).toBe(true);
    expect(startCmds.some((c) => c.includes('session register'))).toBe(true);

    const end = JSON.parse(
      readFileSync(join(root, '.revealui/adapters/grok/hooks/session-end.json'), 'utf-8'),
    ) as { hooks: { SessionEnd: Array<{ hooks: Array<{ command: string }> }> } };
    const endCmds = end.hooks.SessionEnd.flatMap((g) => g.hooks.map((h) => h.command));
    expect(endCmds.some((c) => c.includes('hotfix-check.js'))).toBe(true);
    expect(endCmds.some((c) => c.includes('tmpscript-check.js'))).toBe(true);
    expect(endCmds.some((c) => c.includes('session end'))).toBe(true);
  });

  it('writeManagerAdapterContent emits manager content + cursor hooks + opencode surfaces', () => {
    const root = tempProject();
    materializeManager(root);
    const written = writeManagerAdapterContent(root);
    expect(MANAGER_MATERIALIZE_GENERATORS).toEqual(['claude-code', 'cursor', 'opencode']);
    expect(written.byGenerator['claude-code']).toBeGreaterThan(0);
    expect(written.byGenerator.cursor).toBe(1);
    expect(written.byGenerator.opencode).toBeGreaterThan(0);
    expect(written.total).toBe(
      written.byGenerator['claude-code'] +
        written.byGenerator.cursor +
        written.byGenerator.opencode,
    );

    const hooks = JSON.parse(readFileSync(join(root, '.cursor/hooks.json'), 'utf-8')) as {
      version: number;
      hooks: Record<string, Array<{ command: string; type: string }>>;
    };
    expect(hooks.version).toBe(1);
    expect(hooks.hooks.sessionStart?.[0]?.command).toContain('revealui-harnesses hook cursor');

    // Manager content (claude-code generator) still lands under .revealui/content
    const contentRule = readFileSync(
      join(root, '.revealui/content/rules/code-over-docs.md'),
      'utf-8',
    );
    expect(contentRule.length).toBeGreaterThan(20);

    // OpenCode gets at least one agent or command under .opencode
    const opencodePaths = written.paths.filter((p) => p.startsWith('.opencode/'));
    expect(opencodePaths.length).toBeGreaterThan(0);

    const check = checkManager(root);
    expect(check.ok).toBe(true);
    expect(check.warnings.filter((w) => w.includes('cursor') || w.includes('opencode'))).toEqual(
      [],
    );
  });

  it('materialize preserves existing monorepo manager fields', () => {
    const root = tempProject();
    writeManager(root, {
      version: 1,
      name: 'RevealUI monorepo',
      contentRoot: 'content',
      tracker: {
        path: 'docs/TRACKER.md',
        note: 'Fleet day-to-day board lives in private .jv',
      },
      adapters: [
        { id: 'claude-code', projectTree: '.claude', rank: 'equal' },
        { id: 'cursor', projectTree: '.cursor', rank: 'equal' },
        { id: 'opencode', projectTree: '.opencode', rank: 'equal' },
        { id: 'vscode', projectTree: null, rank: 'equal' },
        { id: 'grok', projectTree: null, rank: 'equal' },
        { id: 'revealui-agent', projectTree: null, rank: 'equal' },
      ],
      mcp: { configPath: 'mcp.json' },
      contentPackage: '@revealui/harnesses',
    });
    materializeManager(root);
    const cfg = loadManager(root);
    expect(cfg.name).toBe('RevealUI monorepo');
    expect(cfg.tracker.note).toContain('private .jv');
  });

  it('check fails without manager and passes after write', () => {
    const root = tempProject();
    expect(checkManager(root).ok).toBe(false);
    writeManager(root);
    const after = checkManager(root);
    expect(after.ok).toBe(true);
  });

  it('writeManager is a no-op when content is already identical', () => {
    const root = tempProject();
    writeManager(root, { version: 1, name: 'same', contentRoot: 'content' });
    const before = readFileSync(join(root, '.revealui/manager.json'), 'utf-8');
    writeManager(root, { version: 1, name: 'same', contentRoot: 'content' });
    const after = readFileSync(join(root, '.revealui/manager.json'), 'utf-8');
    expect(after).toBe(before);
  });
});
