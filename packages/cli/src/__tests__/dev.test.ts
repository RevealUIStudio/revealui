import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  formatDevActions,
  formatDevPlan,
  getDevActions,
  getDevPlan,
  resolveDevUpOptions,
} from '../commands/dev.js';

describe('resolveDevUpOptions', () => {
  let tempRoot: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'revealui-dev-test-'));
    fs.writeFileSync(
      path.join(tempRoot, 'package.json'),
      JSON.stringify({ name: 'revealui', private: true }),
      'utf8',
    );
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('applies the agent profile defaults', () => {
    const resolved = resolveDevUpOptions({ profile: 'agent' });

    expect(resolved.include).toEqual(['mcp']);
    expect(resolved.script).toBeUndefined();
    expect(resolved.ensure).toBe(true);
  });

  it('lets explicit options override the selected profile', () => {
    const resolved = resolveDevUpOptions({
      profile: 'admin',
      script: 'dev:api',
      include: ['mcp'],
    });

    expect(resolved.script).toBe('dev:api');
    expect(resolved.include).toEqual(['mcp']);
  });

  it('uses the fullstack profile for the main dev script plus MCP', () => {
    const resolved = resolveDevUpOptions({ profile: 'fullstack' });

    expect(resolved.script).toBe('dev');
    expect(resolved.include).toEqual(['mcp']);
  });

  it('builds a readable effective plan for status output', () => {
    const plan = getDevPlan({ profile: 'agent', script: 'dev:api' });
    const output = formatDevPlan(plan);

    expect(plan.profile).toBe('agent');
    expect(plan.script).toBe('dev:api');
    expect(output).toContain('RevealUI Dev Plan');
    expect(output).toContain('profile   agent');
    expect(output).toContain('script    dev:api');
  });

  it('uses the configured default profile when none is passed explicitly', () => {
    fs.mkdirSync(path.join(tempRoot, '.revealui'), { recursive: true });
    fs.writeFileSync(
      path.join(tempRoot, '.revealui', 'dev.json'),
      JSON.stringify({ defaultProfile: 'agent' }),
      'utf8',
    );
    process.chdir(tempRoot);

    const resolved = resolveDevUpOptions();

    expect(resolved.profile).toBe('agent');
    expect(resolved.include).toEqual(['mcp']);
  });

  it('includes dry-run and action previews in the effective plan', () => {
    const plan = getDevPlan({ profile: 'fullstack', dryRun: true });
    const actions = getDevActions(plan);
    const planOutput = formatDevPlan(plan);
    const actionOutput = formatDevActions(plan);

    expect(plan.dryRun).toBe(true);
    expect(actions).toContain('run database migrations');
    expect(actions).toContain('validate MCP credentials via `pnpm setup:mcp`');
    expect(actions).toContain('start pnpm script `dev`');
    expect(planOutput).toContain('dry-run   yes');
    expect(actionOutput).toContain('RevealUI Dev Actions');
  });
});
