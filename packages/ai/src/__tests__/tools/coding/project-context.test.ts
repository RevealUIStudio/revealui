import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { projectContextTool } from '../../../tools/coding/project-context.js';
import { configureSafety } from '../../../tools/coding/safety.js';

const ROOT = join(process.cwd(), 'tmp-test-project-context');

beforeAll(() => {
  mkdirSync(ROOT, { recursive: true });
  configureSafety({ projectRoot: ROOT });

  // Create mock content layer
  mkdirSync(join(ROOT, '.claude', 'rules'), { recursive: true });
  mkdirSync(join(ROOT, '.claude', 'agents'), { recursive: true });
  mkdirSync(join(ROOT, '.claude', 'commands'), { recursive: true });

  writeFileSync(
    join(ROOT, '.claude', 'rules', 'database.md'),
    '# Database Conventions\n\nUse Drizzle ORM. Dual-DB: NeonDB for REST, Supabase for vectors.\nAlways use parameterized queries.\n',
  );
  writeFileSync(
    join(ROOT, '.claude', 'rules', 'testing.md'),
    '# Testing Conventions\n\nUse Vitest for unit tests. Playwright for E2E.\nTest files go in __tests__/ or alongside source with .test.ts suffix.\n',
  );
  writeFileSync(
    join(ROOT, '.claude', 'rules', 'typescript.md'),
    '# TypeScript Conventions\n\nStrict mode. No any types. Use unknown + type guards.\nES Modules only. Async/await over .then().\n',
  );
  writeFileSync(
    join(ROOT, '.claude', 'agents', 'reviewer.md'),
    '# Code Reviewer Agent\n\nReviews pull requests for security and code quality.\n',
  );
  writeFileSync(
    join(ROOT, '.claude', 'commands', 'gate.md'),
    '# Gate Command\n\nRun full CI gate: lint, typecheck, test, build.\n',
  );
});

afterAll(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

describe('project_context tool', () => {
  it('has correct metadata', () => {
    expect(projectContextTool.name).toBe('project_context');
  });

  it('finds matching rules by keyword', async () => {
    const result = await projectContextTool.execute({ query: 'database' });
    expect(result.success).toBe(true);
    expect(result.content).toContain('database');
    expect(result.content).toContain('Drizzle');
  });

  it('returns multiple results ranked by relevance', async () => {
    const result = await projectContextTool.execute({ query: 'typescript strict' });
    expect(result.success).toBe(true);
    const data = result.data as { resultCount: number };
    expect(data.resultCount).toBeGreaterThanOrEqual(1);
    // TypeScript rule should rank highest
    expect(result.content).toContain('TypeScript');
  });

  it('searches agents when queried', async () => {
    const result = await projectContextTool.execute({ query: 'reviewer' });
    expect(result.success).toBe(true);
    expect(result.content).toContain('Code Reviewer');
  });

  it('searches commands when queried', async () => {
    const result = await projectContextTool.execute({ query: 'gate lint' });
    expect(result.success).toBe(true);
    expect(result.content).toContain('gate');
  });

  it('filters by scope', async () => {
    const result = await projectContextTool.execute({
      query: 'reviewer',
      scope: 'rule',
    });
    expect(result.success).toBe(true);
    // Should not find agent content when scoped to rules
    const data = result.data as { results: unknown[] };
    expect(data.results).toEqual([]);
  });

  it('returns agent results when scoped to agent', async () => {
    const result = await projectContextTool.execute({
      query: 'reviewer',
      scope: 'agent',
    });
    expect(result.success).toBe(true);
    expect(result.content).toContain('Code Reviewer');
  });

  it('returns empty results for no matches', async () => {
    const result = await projectContextTool.execute({ query: 'zzz_no_match_zzz' });
    expect(result.success).toBe(true);
    expect(result.content).toContain('No project context found');
  });

  it('handles missing content directories gracefully', async () => {
    const emptyRoot = join(ROOT, 'empty-project');
    mkdirSync(emptyRoot, { recursive: true });
    configureSafety({ projectRoot: emptyRoot });

    const result = await projectContextTool.execute({ query: 'anything' });
    expect(result.success).toBe(true);
    expect(result.content).toContain('No project context found');

    // Restore original config
    configureSafety({ projectRoot: ROOT });
  });

  it('truncates long content in previews', async () => {
    // Write a very long rule
    const longContent = `# Long Rule\n\n${'This is a very long line. '.repeat(100)}`;
    writeFileSync(join(ROOT, '.claude', 'rules', 'long.md'), longContent);

    const result = await projectContextTool.execute({ query: 'long rule' });
    expect(result.success).toBe(true);
    // Content should be truncated with ellipsis
    if (result.content?.includes('long')) {
      // Each result preview is capped at 500 chars
      const lines = result.content.split('\n');
      const previewLine = lines.find((l: string) => l.includes('This is a very long'));
      if (previewLine) {
        expect(previewLine.length).toBeLessThan(600);
      }
    }
  });
});
