import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const audit = fileURLToPath(new URL('../../../scripts/audit-no-submodules.sh', import.meta.url));
const fixtureEnv = {
  PATH: process.env.PATH ?? '/usr/bin:/bin',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: '/dev/null',
};

function fixtureGit(directory: string, args: string[]) {
  const result = spawnSync('git', args, {
    cwd: directory,
    encoding: 'utf8',
    env: fixtureEnv,
    timeout: 10_000,
  });
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.trim();
}

async function committedFixture() {
  const directory = await mkdtemp(join(tmpdir(), 'revealui-git-inspection-'));
  try {
    fixtureGit(directory, ['init', '--quiet']);
    fixtureGit(directory, [
      '-c',
      'user.name=Audit fixture',
      '-c',
      'user.email=fixture@example.invalid',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '--quiet',
      '--allow-empty',
      '-m',
      'fixture',
    ]);
    return directory;
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

async function failingGit(directory: string, command: string) {
  const found = spawnSync('bash', ['-c', 'command -v git'], {
    env: fixtureEnv,
    encoding: 'utf8',
    timeout: 10_000,
  });
  expect(found.error).toBeUndefined();
  expect(found.status).toBe(0);
  const git = found.stdout.trim();
  const bin = join(directory, 'fixture-bin');
  await mkdir(bin);
  const quotedGit = `'${git.replaceAll("'", "'\\''")}'`;
  await writeFile(
    join(bin, 'git'),
    `#!/usr/bin/env bash\nif [ "$1" = "${command}" ]; then echo "injected Git inspection failure" >&2; exit 73; fi\nexec ${quotedGit} "$@"\n`,
    { mode: 0o755 },
  );
  return { ...fixtureEnv, PATH: `${bin}:${fixtureEnv.PATH}` };
}

it('refuses to certify submodule absence outside a Git worktree', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'revealui-git-inspection-'));
  try {
    const result = spawnSync('bash', [audit], {
      cwd: directory,
      encoding: 'utf8',
      timeout: 10_000,
      env: { PATH: process.env.PATH ?? '/usr/bin:/bin' },
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(2);
    expect(result.stdout).not.toContain('PASS: No submodules found.');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it('refuses to certify a worktree whose HEAD has no tree', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'revealui-git-inspection-'));
  try {
    const initialized = spawnSync('git', ['init', '--quiet'], {
      cwd: directory,
      encoding: 'utf8',
      env: fixtureEnv,
      timeout: 10_000,
    });
    expect(initialized.error).toBeUndefined();
    expect(initialized.status).toBe(0);
    const result = spawnSync('bash', [audit], {
      cwd: directory,
      encoding: 'utf8',
      env: fixtureEnv,
      timeout: 10_000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(2);
    expect(result.stdout).not.toContain('PASS: No submodules found.');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it('reports a required Git config inspection failure as an error', async () => {
  const directory = await committedFixture();
  try {
    const result = spawnSync('bash', [audit], {
      cwd: directory,
      encoding: 'utf8',
      env: await failingGit(directory, 'config'),
      timeout: 10_000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(2);
    expect(result.stdout).not.toContain('PASS: No submodules found.');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it('reports a required Git tree inspection failure as an error', async () => {
  const directory = await committedFixture();
  try {
    const result = spawnSync('bash', [audit], {
      cwd: directory,
      encoding: 'utf8',
      env: await failingGit(directory, 'ls-tree'),
      timeout: 10_000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(2);
    expect(result.stdout).not.toContain('PASS: No submodules found.');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it('detects stored submodule artifacts in a linked worktree common directory', async () => {
  const directory = await committedFixture();
  try {
    const linked = join(directory, 'linked');
    fixtureGit(directory, ['worktree', 'add', '--quiet', '-b', 'fixture-linked', linked]);
    await mkdir(join(directory, '.git', 'modules', 'legacy'), { recursive: true });
    const result = spawnSync('bash', [audit], {
      cwd: linked,
      encoding: 'utf8',
      env: fixtureEnv,
      timeout: 10_000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain('PASS: No submodules found.');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it('detects a dangling .gitmodules link as a policy artifact', async () => {
  const directory = await committedFixture();
  try {
    await symlink('missing-module-config', join(directory, '.gitmodules'));
    const result = spawnSync('bash', [audit], {
      cwd: directory,
      encoding: 'utf8',
      env: fixtureEnv,
      timeout: 10_000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain('PASS: No submodules found.');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it('detects module storage whose only artifact name is a newline', async () => {
  const directory = await committedFixture();
  try {
    await mkdir(join(directory, '.git', 'modules', '\n'), { recursive: true });
    const result = spawnSync('bash', [audit], {
      cwd: directory,
      encoding: 'utf8',
      env: fixtureEnv,
      timeout: 10_000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain('PASS: No submodules found.');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it.each(['worktree', 'Git directory', 'linked common directory'] as const)(
  'preserves trailing newline bytes in the resolved %s path',
  async (shape) => {
    const parent = await mkdtemp(join(tmpdir(), 'revealui-git-path-'));
    try {
      const directory = join(parent, shape === 'worktree' ? 'target\n' : 'target');
      await mkdir(directory);
      let cwd = directory;
      let env: NodeJS.ProcessEnv = fixtureEnv;
      let gitArgs: string[] = [];
      if (shape !== 'worktree') {
        const metadata = join(parent, 'metadata\n');
        await mkdir(join(parent, 'metadata'));
        gitArgs = ['--git-dir', metadata, '--work-tree', directory];
        env = { ...fixtureEnv, GIT_DIR: metadata, GIT_WORK_TREE: directory };
      }
      fixtureGit(directory, [...gitArgs, 'init', '--quiet']);
      fixtureGit(directory, [
        ...gitArgs,
        '-c',
        'user.name=Audit fixture',
        '-c',
        'user.email=fixture@example.invalid',
        '-c',
        'commit.gpgsign=false',
        'commit',
        '--quiet',
        '--allow-empty',
        '-m',
        'fixture',
      ]);
      if (shape === 'worktree') {
        const sibling = join(parent, 'target');
        await mkdir(sibling);
        fixtureGit(sibling, ['init', '--quiet']);
        fixtureGit(sibling, [
          '-c',
          'user.name=Audit fixture',
          '-c',
          'user.email=fixture@example.invalid',
          '-c',
          'commit.gpgsign=false',
          'commit',
          '--quiet',
          '--allow-empty',
          '-m',
          'fixture',
        ]);
        await writeFile(join(directory, '.gitmodules'), '');
      } else {
        await mkdir(join(parent, 'metadata\n', 'modules', 'legacy'), { recursive: true });
        if (shape === 'linked common directory') {
          cwd = join(parent, 'linked');
          fixtureGit(directory, [
            ...gitArgs,
            'worktree',
            'add',
            '--quiet',
            '-b',
            'fixture-linked',
            cwd,
          ]);
          env = fixtureEnv;
        }
      }
      const result = spawnSync('bash', [audit], { cwd, encoding: 'utf8', env, timeout: 10_000 });
      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(1);
      expect(result.stdout).not.toContain('PASS: No submodules found.');
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  },
);

it.each([
  ['clean', 0],
  ['nested working directory', 0],
  ['clean linked worktree', 0],
  ['gitmodules file', 1],
  ['configured submodule', 1],
  ['tree gitlink', 1],
  ['stored modules', 1],
  ['empty modules directory', 0],
  ['corrupt HEAD object', 2],
  ['module listing error', 2],
] as const)('preserves policy outcomes for %s', async (shape, status) => {
  const directory = await committedFixture();
  try {
    let cwd = directory;
    let env = fixtureEnv;
    switch (shape) {
      case 'nested working directory':
        cwd = join(directory, 'nested');
        await mkdir(cwd);
        break;
      case 'clean linked worktree':
        cwd = join(directory, 'linked');
        fixtureGit(directory, ['worktree', 'add', '--quiet', '-b', 'fixture-linked', cwd]);
        break;
      case 'gitmodules file':
        await writeFile(join(directory, '.gitmodules'), '');
        break;
      case 'configured submodule':
        fixtureGit(directory, [
          'config',
          'submodule.synthetic.url',
          'https://example.invalid/fixture',
        ]);
        break;
      case 'tree gitlink': {
        const commit = fixtureGit(directory, ['rev-parse', 'HEAD']);
        fixtureGit(directory, [
          'update-index',
          '--add',
          '--cacheinfo',
          `160000,${commit},synthetic`,
        ]);
        fixtureGit(directory, [
          '-c',
          'user.name=Audit fixture',
          '-c',
          'user.email=fixture@example.invalid',
          '-c',
          'commit.gpgsign=false',
          'commit',
          '--quiet',
          '-m',
          'synthetic gitlink',
        ]);
        break;
      }
      case 'stored modules':
        await mkdir(join(directory, '.git', 'modules', 'synthetic'), { recursive: true });
        break;
      case 'empty modules directory':
        await mkdir(join(directory, '.git', 'modules'));
        break;
      case 'corrupt HEAD object': {
        const ref = fixtureGit(directory, ['symbolic-ref', 'HEAD']);
        await writeFile(join(directory, '.git', ref), `${'9'.repeat(40)}\n`);
        break;
      }
      case 'module listing error': {
        await mkdir(join(directory, '.git', 'modules'));
        const bin = join(directory, 'fixture-bin');
        await mkdir(bin);
        await writeFile(join(bin, 'ls'), '#!/usr/bin/env bash\nexit 74\n', { mode: 0o755 });
        env = { ...fixtureEnv, PATH: `${bin}:${fixtureEnv.PATH}` };
        break;
      }
    }
    const result = spawnSync('bash', [audit], { cwd, encoding: 'utf8', env, timeout: 10_000 });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(status);
    if (status === 0) expect(result.stdout).toContain('PASS: No submodules found.');
    else expect(result.stdout).not.toContain('PASS: No submodules found.');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
