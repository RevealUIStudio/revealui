/**
 * Integration tests for createProject()
 *
 * Tests the scaffolding logic directly (bypasses interactive prompts).
 * Uses a temp directory for output and verifies generated file contents.
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createProject } from '../commands/create.js';

// Minimal config that skips all optional steps
const minimalConfig = {
  project: {
    projectName: 'test-scaffold',
    projectPath: '', // set per-test
    template: 'basic-blog' as const,
  },
  database: { provider: 'skip' as const },
  storage: { provider: 'skip' as const },
  payment: { enabled: false },
  devenv: { createDevContainer: false, createDevbox: false },
  skipGit: true,
  skipInstall: true,
};

describe('createProject', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'revealui-cli-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('copies starter template files into target directory', async () => {
    const projectPath = path.join(tmpDir, 'test-scaffold');

    await createProject({
      ...minimalConfig,
      project: { ...minimalConfig.project, projectPath },
    });

    // Core template files should exist
    const files = await fs.readdir(projectPath);
    expect(files).toContain('package.json');
    expect(files).toContain('tsconfig.json');
    expect(files).toContain('next.config.mjs');
    expect(files).toContain('.env.local');
    expect(files).toContain('README.md');
    expect(files).toContain('src');
  });

  it('replaces {{PROJECT_NAME}} placeholder in package.json', async () => {
    const projectPath = path.join(tmpDir, 'my-project');

    await createProject({
      ...minimalConfig,
      project: { ...minimalConfig.project, projectName: 'my-project', projectPath },
    });

    const pkgJson = JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8'));
    expect(pkgJson.name).toBe('my-project');
  });

  it('writes .env.local with placeholder values when skipping integrations', async () => {
    const projectPath = path.join(tmpDir, 'env-test');

    await createProject({
      ...minimalConfig,
      project: { ...minimalConfig.project, projectName: 'env-test', projectPath },
    });

    const env = await fs.readFile(path.join(projectPath, '.env.local'), 'utf-8');
    expect(env).toContain('REVEALUI_SECRET=');
    expect(env).toContain('POSTGRES_URL=postgresql://');
    expect(env).toContain('STRIPE_SECRET_KEY=sk_test_placeholder');
    expect(env).toContain('BLOB_READ_WRITE_TOKEN=vercel_blob_rw_placeholder');
  });

  it('writes .env.local with provided database URL', async () => {
    const projectPath = path.join(tmpDir, 'db-test');
    const postgresUrl = 'postgresql://user:pass@neon.tech/mydb';

    await createProject({
      ...minimalConfig,
      project: { ...minimalConfig.project, projectName: 'db-test', projectPath },
      database: { provider: 'neon', postgresUrl },
    });

    const env = await fs.readFile(path.join(projectPath, '.env.local'), 'utf-8');
    expect(env).toContain(`POSTGRES_URL=${postgresUrl}`);
  });

  it('generates devcontainer config when requested', async () => {
    const projectPath = path.join(tmpDir, 'devcontainer-test');

    await createProject({
      ...minimalConfig,
      project: { ...minimalConfig.project, projectName: 'devcontainer-test', projectPath },
      devenv: { createDevContainer: true, createDevbox: false },
    });

    const entries = await fs.readdir(projectPath);
    expect(entries).toContain('.devcontainer');
  });

  it('generates devbox.json when requested', async () => {
    const projectPath = path.join(tmpDir, 'devbox-test');

    await createProject({
      ...minimalConfig,
      project: { ...minimalConfig.project, projectName: 'devbox-test', projectPath },
      devenv: { createDevContainer: false, createDevbox: true },
    });

    const entries = await fs.readdir(projectPath);
    expect(entries).toContain('devbox.json');
  });

  it('renames _gitignore to .gitignore in output', async () => {
    const projectPath = path.join(tmpDir, 'gitignore-test');

    await createProject({
      ...minimalConfig,
      project: { ...minimalConfig.project, projectName: 'gitignore-test', projectPath },
    });

    const entries = await fs.readdir(projectPath);
    expect(entries).toContain('.gitignore');
    expect(entries).not.toContain('_gitignore');
  });

  it('scaffolds src/app/ with layout and page', async () => {
    const projectPath = path.join(tmpDir, 'src-test');

    await createProject({
      ...minimalConfig,
      project: { ...minimalConfig.project, projectName: 'src-test', projectPath },
    });

    const srcApp = path.join(projectPath, 'src', 'app');
    const appFiles = await fs.readdir(srcApp);
    expect(appFiles).toContain('layout.tsx');
    expect(appFiles).toContain('page.tsx');
    expect(appFiles).toContain('globals.css');
  });
});
