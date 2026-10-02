const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, chmodSync, existsSync, utimesSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { test } = require('node:test');
const root = resolve(__dirname, '../../..');

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'revealui-push-test-'));
  const repo = join(directory, 'repo');
  const remote = join(directory, 'remote.git');
  const bin = join(directory, 'bin');
  mkdirSync(repo); mkdirSync(bin);
  // Git hooks export repository-local namespace/configuration variables.
  // A cwd change alone does not isolate a synthetic repository from that
  // outer checkout: even git init/commit can otherwise target its metadata.
  const localVariables = spawnSync('git', ['rev-parse', '--local-env-vars'], {
    cwd: root, encoding: 'utf8',
  });
  assert.equal(localVariables.status, 0, localVariables.stderr);
  const env = { ...process.env, TMPDIR: directory, PATH: `${bin}:${process.env.PATH}` };
  for (const name of localVariables.stdout.trim().split('\n')) delete env[name];
  for (const name of Object.keys(env)) {
    if (/^GIT_CONFIG_(KEY|VALUE)_\d+$/.test(name)) delete env[name];
  }
  const run = (args, cwd = repo, gitEnv = env) => spawnSync('git', args, { cwd, env: gitEnv, encoding: 'utf8' });
  assert.equal(run(['init', '--bare', remote], directory).status, 0);
  assert.equal(run(['init', '-b', 'feature']).status, 0);
  // Synthetic repositories own their hook configuration, independent of the
  // developer's global Git template or conditional include settings.
  assert.equal(run(['config', 'core.hooksPath', '.git/hooks']).status, 0);
  mkdirSync(join(repo, '.git/info'), { recursive: true });
  writeFileSync(join(repo, 'tracked'), 'original\n');
  assert.equal(run(['add', 'tracked']).status, 0);
  assert.equal(run(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'fixture']).status, 0);
  assert.equal(run(['remote', 'add', 'origin', remote]).status, 0);
  mkdirSync(join(repo, 'node_modules'));
  copyFileSync(join(root, '.husky/pre-push'), join(repo, '.git/hooks/pre-push'));
  chmodSync(join(repo, '.git/hooks/pre-push'), 0o755);
  writeFileSync(join(bin, 'pnpm'), '#!/bin/sh\nprintf "%s\\n" "$*" >> "$TMPDIR/checks"\nif [ "${FIXTURE_GATE_WAIT:-0}" = "1" ]; then sleep 30; fi\nif [ "${FIXTURE_GATE_MUTATE:-0}" = "1" ]; then echo changed >> tracked; fi\nexit "${FIXTURE_GATE_EXIT:-0}"\n');
  chmodSync(join(bin, 'pnpm'), 0o755);
  const push = (args = []) => spawnSync('bash', [join(root, 'scripts/git-hooks/push.sh'), ...args], { cwd: repo, env, encoding: 'utf8' });
  return { directory, repo, remote, env, run, push };
}

test('normal helper pushes the validated HEAD and preserves existing saved work and caches', () => {
  const f = fixture();
  for (const name of ['revealui-push-stash-old', 'revealui-gate-worktree-old', 'agent-stash-old']) {
    const path = join(f.directory, name); mkdirSync(path); writeFileSync(join(path, 'evidence'), 'preserve');
    utimesSync(path, new Date(0), new Date(0));
  }
  mkdirSync(join(f.repo, '.turbo')); writeFileSync(join(f.repo, '.turbo/cache'), 'cached');
  // Real ignored cache data must not be treated as dirty source.
  writeFileSync(join(f.repo, '.git/info/exclude'), '.turbo/\n');
  const result = f.push();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(f.run(['rev-parse', 'refs/heads/feature'], f.remote).stdout.trim(), f.run(['rev-parse', 'HEAD']).stdout.trim());
  assert.match(readFileSync(join(f.directory, 'checks'), 'utf8'), /gate --phase=1 --changed/);
  assert.equal(readFileSync(join(f.repo, '.turbo/cache'), 'utf8'), 'cached');
  for (const name of ['revealui-push-stash-old', 'revealui-gate-worktree-old', 'agent-stash-old']) assert.equal(readFileSync(join(f.directory, name, 'evidence'), 'utf8'), 'preserve');
});

test('native fixtures invoked by a real outer push hook preserve its repository namespace', () => {
  const f = fixture();
  assert.equal(f.run(['config', 'push.autoSetupRemote', 'false']).status, 0);
  const source = f.run(['rev-parse', 'HEAD']).stdout.trim();
  const branches = f.run(['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads']).stdout;
  const index = readFileSync(join(f.repo, '.git/index'));
  const config = readFileSync(join(f.repo, '.git/config'));
  const tracked = readFileSync(join(f.repo, 'tracked'));
  const cleanEnvironment = { ...f.env };
  Object.assign(f.env, {
    GIT_DIR: join(f.repo, '.git'),
    GIT_WORK_TREE: f.repo,
    GIT_INDEX_FILE: join(f.repo, '.git/index'),
    GIT_COMMON_DIR: join(f.repo, '.git'),
    GIT_OBJECT_DIRECTORY: join(f.repo, '.git/objects'),
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'fixture.namespace',
    GIT_CONFIG_VALUE_0: 'outer-hook',
  });
  // Execute the actual native fixture code from an actual Git pre-push hook.
  // Select its existing success case so this regression cannot recurse.
  writeFileSync(join(f.directory, 'bin/pnpm'), `#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const { writeFileSync } = require('node:fs');
writeFileSync(${JSON.stringify(join(f.directory, 'hook-namespace.json'))}, JSON.stringify({
  directory: process.env.GIT_DIR, index: process.env.GIT_INDEX_FILE,
  common: process.env.GIT_COMMON_DIR, configCount: process.env.GIT_CONFIG_COUNT,
}));
const env = { ...process.env };
delete env.NODE_TEST_CONTEXT;
const result = spawnSync(process.execPath,
  ['--test', '--test-name-pattern=^normal helper pushes', ${JSON.stringify(__filename)}],
  { env, stdio: 'inherit' });
process.exit(result.status ?? 1);
`);
  chmodSync(join(f.directory, 'bin/pnpm'), 0o755);
  const result = f.push();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /normal helper pushes the validated HEAD/);
  const inherited = JSON.parse(readFileSync(join(f.directory, 'hook-namespace.json'), 'utf8'));
  assert.ok(inherited.directory);
  assert.equal(inherited.index, join(f.repo, '.git/index'));
  assert.equal(inherited.common, join(f.repo, '.git'));
  assert.equal(inherited.configCount, '1');
  assert.equal(f.run(['rev-parse', 'HEAD']).stdout.trim(), source);
  assert.equal(f.run(['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads']).stdout, branches);
  assert.deepEqual(readFileSync(join(f.repo, '.git/index')), index);
  assert.deepEqual(readFileSync(join(f.repo, '.git/config')), config);
  assert.deepEqual(readFileSync(join(f.repo, 'tracked')), tracked);
  assert.equal(f.run(['status', '--porcelain']).stdout, '');
  const remote = f.run(['rev-parse', 'refs/heads/feature'], f.remote, cleanEnvironment);
  assert.equal(remote.status, 0, remote.stderr);
  assert.equal(remote.stdout.trim(), source);
});

test('failed required validation leaves remote unchanged', () => {
  const f = fixture(); f.env.FIXTURE_GATE_EXIT = '7';
  assert.notEqual(f.push().status, 0);
  assert.notEqual(f.run(['rev-parse', '--verify', 'refs/heads/feature'], f.remote).status, 0);
  assert.equal(f.run(['status', '--porcelain']).stdout, '');
});

test('protected destination retains quality and type gates for exact HEAD', () => {
  const f = fixture();
  const result = f.push(['test']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(join(f.directory, 'checks'), 'utf8'), /gate --no-build --no-test/);
  assert.equal(f.run(['rev-parse', 'refs/heads/test'], f.remote).stdout.trim(), f.run(['rev-parse', 'HEAD']).stdout.trim());
});

test('a source mutation during validation is preserved and prevents publication', () => {
  const f = fixture(); f.env.FIXTURE_GATE_MUTATE = '1';
  const result = f.push();
  assert.notEqual(result.status, 0); assert.match(result.stderr, /source changed during validation/);
  assert.notEqual(f.run(['rev-parse', '--verify', 'refs/heads/feature'], f.remote).status, 0);
  assert.equal(readFileSync(join(f.repo, 'tracked'), 'utf8'), 'original\nchanged\n');
});

test('dirty staged rename/deletion and unusual untracked paths are preserved on rejection', () => {
  const f = fixture();
  assert.equal(f.run(['mv', 'tracked', 'renamed name']).status, 0);
  writeFileSync(join(f.repo, 'renamed name'), 'modified after staging\n');
  writeFileSync(join(f.repo, 'untracked\nname'), 'untracked');
  const before = f.run(['status', '--porcelain=v1', '-z']).stdout;
  const index = readFileSync(join(f.repo, '.git/index'));
  const result = f.push();
  assert.notEqual(result.status, 0); assert.match(result.stderr, /uncommitted work is preserved/);
  assert.equal(f.run(['status', '--porcelain=v1', '-z']).stdout, before);
  assert.deepEqual(readFileSync(join(f.repo, '.git/index')), index);
  assert.equal(readFileSync(join(f.repo, 'renamed name'), 'utf8'), 'modified after staging\n');
  assert.equal(readFileSync(join(f.repo, 'untracked\nname'), 'utf8'), 'untracked');
  assert.equal(existsSync(join(f.directory, 'checks')), false);
});

test('direct push of a different source commit is rejected before checks', () => {
  const f = fixture(); const old = f.run(['rev-parse', 'HEAD']).stdout.trim();
  writeFileSync(join(f.repo, 'tracked'), 'next\n'); f.run(['add', 'tracked']);
  assert.equal(f.run(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'next']).status, 0);
  const result = f.run(['push', 'origin', `${old}:refs/heads/other`]);
  assert.notEqual(result.status, 0); assert.match(result.stderr, /source differs from HEAD/);
  assert.equal(existsSync(join(f.directory, 'checks')), false);
});

test('a second direct hook rejects contention without overwriting the active sentinel', async () => {
  const f = fixture();
  const lock = join(f.repo, '.git/prepush-admission.lock');
  const sentinel = join(f.repo, '.git/gate-in-progress');
  const holder = spawn('flock', [lock, 'sh', '-c', 'echo ready; cat >/dev/null'], {
    env: f.env, stdio: ['pipe', 'pipe', 'pipe'],
  });
  const exited = new Promise((resolve) => holder.once('exit', resolve));
  await new Promise((resolve, reject) => { holder.stdout.once('data', resolve); holder.once('error', reject); });
  writeFileSync(sentinel, 'fixture-owner');
  try {
    const result = f.run(['push', 'origin', 'HEAD:refs/heads/feature']);
    assert.notEqual(result.status, 0); assert.match(result.stderr, /another hook owns this checkout/);
    assert.equal(readFileSync(sentinel, 'utf8'), 'fixture-owner');
    assert.equal(existsSync(join(f.directory, 'checks')), false);
  } finally { holder.stdin.end(); await exited; }
});

test('annotated tags and branch deletions retain their early no-check contract', () => {
  const f = fixture();
  assert.equal(f.push().status, 0);
  const before = readFileSync(join(f.directory, 'checks'), 'utf8');
  assert.equal(f.run(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'tag', '-a', 'v-fixture', '-m', 'fixture']).status, 0);
  const tagged = f.run(['push', 'origin', 'refs/tags/v-fixture']);
  assert.equal(tagged.status, 0, tagged.stderr);
  const deleted = f.run(['push', 'origin', ':refs/heads/feature']);
  assert.equal(deleted.status, 0, deleted.stderr);
  assert.equal(readFileSync(join(f.directory, 'checks'), 'utf8'), before);
  assert.equal(existsSync(join(f.repo, '.git/gate-in-progress')), false);
});

test('multiple branch refs validate their shared source with protected scope', () => {
  const f = fixture();
  const result = f.run(['push', 'origin', 'HEAD:refs/heads/feature', 'HEAD:refs/heads/test']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(join(f.directory, 'checks'), 'utf8'), 'gate --no-build --no-test\n');
  const head = f.run(['rev-parse', 'HEAD']).stdout.trim();
  assert.equal(f.run(['rev-parse', 'refs/heads/test'], f.remote).stdout.trim(), head);
  assert.equal(f.run(['rev-parse', 'refs/heads/feature'], f.remote).stdout.trim(), head);
});

test('a live aged lock remains exclusive and is released by its owner', async () => {
  const f = fixture(); const lock = join(f.directory, `revealui-push-${process.getuid()}.lock`);
  const holder = spawn('flock', [lock, 'sh', '-c', 'echo ready; cat >/dev/null'], { env: f.env, stdio: ['pipe', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => { holder.stdout.once('data', resolve); holder.once('error', reject); });
  utimesSync(lock, new Date(0), new Date(0));
  const child = spawn('bash', [join(root, 'scripts/git-hooks/push.sh')], { cwd: f.repo, env: f.env, stdio: ['ignore', 'pipe', 'pipe'] });
  const exited = new Promise((resolve) => child.once('exit', resolve));
  try {
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(child.exitCode, null); assert.equal(existsSync(join(f.directory, 'checks')), false);
  } finally { holder.stdin.end(); }
  assert.equal(await exited, 0);
  assert.equal(existsSync(lock), true);
});

test('interrupting an owned push process group releases its kernel lease without removing its lock file', { timeout: 10000 }, async () => {
  const f = fixture(); f.env.FIXTURE_GATE_WAIT = '1';
  const lock = join(f.directory, `revealui-push-${process.getuid()}.lock`);
  const child = spawn('bash', [join(root, 'scripts/git-hooks/push.sh')], {
    cwd: f.repo, env: f.env, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const exited = new Promise((resolve) => child.once('exit', resolve));
  try {
    while (!existsSync(join(f.directory, 'checks'))) {
      assert.equal(child.exitCode, null);
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.notEqual(spawnSync('flock', ['--nonblock', lock, 'true']).status, 0);
  } finally {
    // This is only the synthetic process group created by this test.
    process.kill(-child.pid, 'SIGTERM');
    await exited;
  }
  // The leader's exit event can precede delivery of SIGTERM to its remaining
  // group members. Admission stays held until the last inherited owner exits.
  const deadline = Date.now() + 2000;
  while (spawnSync('flock', ['--nonblock', lock, 'true']).status !== 0) {
    assert.ok(Date.now() < deadline, 'terminated owners must release admission');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(existsSync(lock), true);
  assert.equal(f.run(['status', '--porcelain']).stdout, '');
  assert.notEqual(f.run(['rev-parse', '--verify', 'refs/heads/feature'], f.remote).status, 0);
});
