import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getCodemod,
  listApplicableCodemods,
  readInstalledVersion,
  registry,
  runCodemods,
} from '../codemods/index.js';
import { passwordHasherToAuth } from '../codemods/transforms/password-hasher-to-auth.js';

/**
 * Build a minimal fixture project on disk so the runner's file discovery,
 * version detection, and write behavior are exercised end-to-end.
 */
async function makeFixture(opts: {
  securityVersion: string | null;
  files: Record<string, string>;
}): Promise<string> {
  const cwd = await mkdtemp(path.join(tmpdir(), 'revealui-codemod-'));
  const pkg: Record<string, unknown> = {
    name: 'fixture',
    version: '0.0.0',
    dependencies: {},
  };
  if (opts.securityVersion) {
    (pkg.dependencies as Record<string, string>)['@revealui/security'] = opts.securityVersion;
    const nmDir = path.join(cwd, 'node_modules', '@revealui', 'security');
    await mkdir(nmDir, { recursive: true });
    await writeFile(
      path.join(nmDir, 'package.json'),
      JSON.stringify({ name: '@revealui/security', version: opts.securityVersion }),
      'utf8',
    );
  }
  await writeFile(path.join(cwd, 'package.json'), JSON.stringify(pkg), 'utf8');
  for (const [rel, content] of Object.entries(opts.files)) {
    const abs = path.join(cwd, rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, content, 'utf8');
  }
  return cwd;
}

describe('codemod registry', () => {
  it('exposes the password-hasher-to-auth codemod', () => {
    expect(registry.length).toBeGreaterThan(0);
    expect(getCodemod('password-hasher-to-auth')).toBeDefined();
    expect(getCodemod('does-not-exist')).toBeUndefined();
  });
});

describe('password-hasher-to-auth transform', () => {
  const api = {
    filePath: '/fake.ts',
    logger: { info: () => {}, warn: () => {}, error: () => {} },
  };

  it('returns null when the source does not reference PasswordHasher', () => {
    const source = `import { OAuthClient } from '@revealui/security';\nconst x = 1;\n`;
    expect(passwordHasherToAuth.transform(source, api)).toBeNull();
  });

  it('rewrites a sole PasswordHasher import to @revealui/auth', () => {
    const source = `import { PasswordHasher } from '@revealui/security';
const hash = await PasswordHasher.hash('pw');
const ok = await PasswordHasher.verify('pw', hash);
`;
    const out = passwordHasherToAuth.transform(source, api);
    expect(out).not.toBeNull();
    expect(out).toContain("import { hashPassword, verifyPassword } from '@revealui/auth'");
    expect(out).not.toContain("from '@revealui/security'");
    expect(out).toContain('hashPassword(');
    expect(out).toContain('verifyPassword(');
    expect(out).not.toContain('PasswordHasher');
  });

  it('preserves other named imports from @revealui/security', () => {
    const source = `import { OAuthClient, PasswordHasher, TwoFactorAuth } from '@revealui/security';
const h = PasswordHasher.hash('x');
`;
    const out = passwordHasherToAuth.transform(source, api);
    expect(out).not.toBeNull();
    expect(out).toContain("import { OAuthClient, TwoFactorAuth } from '@revealui/security'");
    expect(out).toContain("import { hashPassword, verifyPassword } from '@revealui/auth'");
    expect(out).toContain('hashPassword(');
  });

  it('is idempotent — running twice produces the same output', () => {
    const source = `import { PasswordHasher } from '@revealui/security';
await PasswordHasher.hash('pw');
`;
    const once = passwordHasherToAuth.transform(source, api);
    expect(once).not.toBeNull();
    const twice = passwordHasherToAuth.transform(once as string, api);
    // After the first pass nothing further needs changing.
    expect(twice).toBeNull();
  });

  it('only matches recognized file extensions', () => {
    expect(passwordHasherToAuth.match?.('/foo.ts')).toBe(true);
    expect(passwordHasherToAuth.match?.('/foo.tsx')).toBe(true);
    expect(passwordHasherToAuth.match?.('/foo.js')).toBe(true);
    expect(passwordHasherToAuth.match?.('/foo.md')).toBe(false);
  });
});

describe('readInstalledVersion', () => {
  let cwd: string;
  afterEach(async () => {
    if (cwd) await rm(cwd, { recursive: true, force: true });
  });

  it('reads the resolved version from node_modules when present', async () => {
    cwd = await makeFixture({ securityVersion: '0.2.7', files: {} });
    expect(await readInstalledVersion(cwd, '@revealui/security')).toBe('0.2.7');
  });

  it('falls back to the declared range when node_modules is absent', async () => {
    cwd = await mkdtemp(path.join(tmpdir(), 'revealui-codemod-'));
    await writeFile(
      path.join(cwd, 'package.json'),
      JSON.stringify({
        name: 'fixture',
        dependencies: { '@revealui/security': '^0.2.4' },
      }),
      'utf8',
    );
    expect(await readInstalledVersion(cwd, '@revealui/security')).toBe('0.2.4');
  });

  it('returns null when the package is not listed at all', async () => {
    cwd = await makeFixture({ securityVersion: null, files: {} });
    expect(await readInstalledVersion(cwd, '@revealui/security')).toBeNull();
  });
});

describe('listApplicableCodemods', () => {
  let cwd: string;
  afterEach(async () => {
    if (cwd) await rm(cwd, { recursive: true, force: true });
  });

  it('marks the codemod applicable when installed version is below the target', async () => {
    cwd = await makeFixture({ securityVersion: '0.2.7', files: {} });
    const applicable = await listApplicableCodemods(cwd);
    const entry = applicable.find((a) => a.codemod.name === 'password-hasher-to-auth');
    expect(entry?.applicable).toBe(true);
  });

  it('marks the codemod not applicable when already migrated', async () => {
    cwd = await makeFixture({ securityVersion: '0.3.0', files: {} });
    const applicable = await listApplicableCodemods(cwd);
    const entry = applicable.find((a) => a.codemod.name === 'password-hasher-to-auth');
    expect(entry?.applicable).toBe(false);
    expect(entry?.reason).toContain('does not satisfy');
  });

  it('marks the codemod not applicable when the package is absent', async () => {
    cwd = await makeFixture({ securityVersion: null, files: {} });
    const applicable = await listApplicableCodemods(cwd);
    const entry = applicable.find((a) => a.codemod.name === 'password-hasher-to-auth');
    expect(entry?.applicable).toBe(false);
    expect(entry?.reason).toContain('not installed');
  });
});

describe('runCodemods', () => {
  let cwd: string;
  const sourceBefore = `import { PasswordHasher } from '@revealui/security';
export async function login(pw: string) {
  const h = await PasswordHasher.hash(pw);
  return await PasswordHasher.verify(pw, h);
}
`;

  beforeEach(async () => {
    cwd = await makeFixture({
      securityVersion: '0.2.7',
      files: { 'src/login.ts': sourceBefore },
    });
  });

  afterEach(async () => {
    if (cwd) await rm(cwd, { recursive: true, force: true });
  });

  it('applies the codemod and rewrites the file', async () => {
    const result = await runCodemods({ cwd });
    expect(result.applied).toContain('password-hasher-to-auth');
    expect(result.changedFiles).toBe(1);
    expect(result.errored).toBe(0);
    const after = await readFile(path.join(cwd, 'src/login.ts'), 'utf8');
    expect(after).toContain("import { hashPassword, verifyPassword } from '@revealui/auth'");
    expect(after).toContain('hashPassword(');
    expect(after).not.toContain('PasswordHasher');
  });

  it('dry-run reports changes without writing', async () => {
    const result = await runCodemods({ cwd, dryRun: true });
    expect(result.changedFiles).toBe(1);
    const after = await readFile(path.join(cwd, 'src/login.ts'), 'utf8');
    expect(after).toBe(sourceBefore);
  });

  it('restricts to a single codemod when `only` is set', async () => {
    const result = await runCodemods({ cwd, only: 'password-hasher-to-auth' });
    expect(result.applied).toEqual(['password-hasher-to-auth']);
  });

  it('reports no-op when no codemod applies', async () => {
    const freshCwd = await makeFixture({
      securityVersion: '0.3.0',
      files: { 'src/login.ts': sourceBefore },
    });
    try {
      const result = await runCodemods({ cwd: freshCwd });
      expect(result.applied).toEqual([]);
      expect(result.changedFiles).toBe(0);
      // Source must be untouched when no codemod applies.
      expect(await readFile(path.join(freshCwd, 'src/login.ts'), 'utf8')).toBe(sourceBefore);
    } finally {
      await rm(freshCwd, { recursive: true, force: true });
    }
  });
});
