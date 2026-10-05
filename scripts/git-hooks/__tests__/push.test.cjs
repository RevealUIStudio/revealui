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
  mkdirSync(join(repo, 'scripts/git-hooks'), { recursive: true });
  mkdirSync(join(repo, '.husky'));
  for (const name of ['push.sh', 'push-admission.cjs']) {
    copyFileSync(join(root, 'scripts/git-hooks', name), join(repo, 'scripts/git-hooks', name));
  }
  copyFileSync(join(root, '.husky/pre-push'), join(repo, '.husky/pre-push'));
  chmodSync(join(repo, '.husky/pre-push'), 0o755);
  writeFileSync(join(repo, '.gitignore'), 'node_modules/\n.husky/_/\n');
  assert.equal(run(['add', '.']).status, 0);
  assert.equal(run(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'fixture']).status, 0);
  assert.equal(run(['remote', 'add', 'origin', remote]).status, 0);
  mkdirSync(join(repo, 'node_modules/husky'), { recursive: true });
  copyFileSync(join(root, 'node_modules/husky/husky'), join(repo, 'node_modules/husky/husky'));
  // Use the declared Husky installer and runtime, including its real sh-to-Bash
  // delegation and inherited descriptors. Do not substitute a test hook runner.
  const installed = spawnSync(process.execPath, [join(root, 'node_modules/husky/bin.js')], { cwd: repo, env, encoding: 'utf8' });
  assert.equal(installed.status, 0, installed.stderr);
  writeFileSync(join(bin, 'pnpm'), '#!/bin/sh\nprintf "%s\\n" "$*" >> "$TMPDIR/checks"\nif [ "${FIXTURE_GATE_WAIT:-0}" = "1" ]; then sleep 30; fi\nif [ "${FIXTURE_GATE_MUTATE:-0}" = "1" ]; then echo changed >> tracked; fi\nexit "${FIXTURE_GATE_EXIT:-0}"\n');
  chmodSync(join(bin, 'pnpm'), 0o755);
  const push = (args = []) => spawnSync('bash', ['-p', join(repo, 'scripts/git-hooks/push.sh'), ...args], { cwd: repo, env, encoding: 'utf8' });
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
  const helper = join(f.repo, 'scripts/git-hooks/nested-fixture.cjs');
  writeFileSync(helper, `const { spawnSync } = require('node:child_process');
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
  const hook = join(f.repo, '.husky/pre-push');
  writeFileSync(hook, '#!/bin/bash\nnode scripts/git-hooks/nested-fixture.cjs\n' + readFileSync(hook, 'utf8'));
  assert.equal(f.run(['add', '.']).status, 0);
  assert.equal(f.run(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'nested fixture']).status, 0);
  const source = f.run(['rev-parse', 'HEAD']).stdout.trim();
  const branches = f.run(['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads']).stdout;
  const index = readFileSync(join(f.repo, '.git/index'));
  const config = readFileSync(join(f.repo, '.git/config'));
  const tracked = readFileSync(join(f.repo, 'tracked'));
  const cleanEnvironment = { ...f.env };
  Object.assign(f.env, {
    GIT_DIR: join(f.repo, '.git'), GIT_WORK_TREE: f.repo,
    GIT_INDEX_FILE: join(f.repo, '.git/index'), GIT_COMMON_DIR: join(f.repo, '.git'),
    GIT_OBJECT_DIRECTORY: join(f.repo, '.git/objects'),
    GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'fixture.namespace', GIT_CONFIG_VALUE_0: 'outer-hook',
  });
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
  assert.notEqual(result.status, 0); assert.match(result.stderr, /Source changed during validation|Clean index and worktree required/);
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
  assert.notEqual(result.status, 0); assert.match(result.stderr, /Use pnpm push/);
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
    assert.notEqual(result.status, 0); assert.match(result.stderr, /Use pnpm push/);
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

test('unadmitted direct pushes reject all branch updates without opening a long gate path', () => {
  const f = fixture();
  const result = f.run(['push', 'origin', 'HEAD:refs/heads/feature', 'HEAD:refs/heads/test']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Use pnpm push/);
  assert.equal(existsSync(join(f.directory, 'checks')), false);
  assert.notEqual(f.run(['rev-parse', '--verify', 'refs/heads/test'], f.remote).status, 0);
  assert.notEqual(f.run(['rev-parse', '--verify', 'refs/heads/feature'], f.remote).status, 0);
});

test('a live aged lock remains exclusive and is released by its owner', async () => {
  const f = fixture(); const lock = join(f.directory, `revealui-push-${process.getuid()}.lock`);
  const holder = spawn('flock', [lock, 'sh', '-c', 'echo ready; cat >/dev/null'], { env: f.env, stdio: ['pipe', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => { holder.stdout.once('data', resolve); holder.once('error', reject); });
  utimesSync(lock, new Date(0), new Date(0));
  const child = spawn('bash', ['-p', join(f.repo, 'scripts/git-hooks/push.sh')], { cwd: f.repo, env: f.env, stdio: ['ignore', 'pipe', 'pipe'] });
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
  const child = spawn('bash', ['-p', join(f.repo, 'scripts/git-hooks/push.sh')], {
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

function commitFixture(f, message = 'fixture policy') {
  assert.equal(f.run(['add', '.']).status, 0);
  assert.equal(f.run(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', message]).status, 0);
}

function replaceHook(f, source) {
  writeFileSync(join(f.repo, '.husky/pre-push'), `#!/bin/bash\nif [ -z "$BASH_VERSION" ]; then exec bash -e "$0" "$@"; fi\nset -euo pipefail\n${source}\n`);
  commitFixture(f);
}

function sshTransport(f) {
  const ssh = join(f.directory, 'ssh.cjs');
  writeFileSync(ssh, `#!/usr/bin/env node
const { spawn } = require('node:child_process');
const { writeFileSync } = require('node:fs');
writeFileSync(${JSON.stringify(join(f.directory, 'transport-started'))}, 'started');
if (process.argv.at(-1) !== ${JSON.stringify(`git-receive-pack '${f.remote}'`)}) process.exit(2);
const receiver = spawn('git', ['receive-pack', ${JSON.stringify(f.remote)}], { stdio: 'inherit' });
writeFileSync(${JSON.stringify(join(f.directory, 'receiver-pid'))}, String(receiver.pid));
receiver.once('exit', (code) => {
  writeFileSync(${JSON.stringify(join(f.directory, 'transport-closed'))}, 'closed');
  process.exit(code ?? 1);
});
`);
  chmodSync(ssh, 0o755);
  f.env.GIT_SSH = ssh;
  f.env.GIT_SSH_VARIANT = 'ssh';
  assert.equal(f.run(['remote', 'set-url', 'origin', `ssh://fixture${f.remote}`]).status, 0);
}

async function waitForFile(filename, child) {
  // A fixture condition barrier, never a sleep used to order product races.
  const deadline = Date.now() + 10000;
  while (!existsSync(filename)) {
    assert.equal(child.exitCode, null, 'fixture must reach its barrier');
    assert.ok(Date.now() < deadline, `fixture did not reach ${filename}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function asyncPush(f) {
  const child = spawn('bash', ['-p', join(f.repo, 'scripts/git-hooks/push.sh')], {
    cwd: f.repo, env: f.env, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = ''; let stderr = '';
  child.stdout.on('data', (data) => { stdout += data; });
  child.stderr.on('data', (data) => { stderr += data; });
  const done = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
  return { child, done };
}

function gateBarrier(f) {
  const fifo = join(f.directory, 'gate-release');
  assert.equal(spawnSync('mkfifo', [fifo]).status, 0);
  writeFileSync(join(f.directory, 'bin/pnpm'), `#!/usr/bin/env node
const fs = require('node:fs');
fs.writeFileSync(${JSON.stringify(join(f.directory, 'checks'))}, process.argv.slice(2).join(' ') + '\\n');
fs.writeFileSync(${JSON.stringify(join(f.directory, 'gate-entered'))}, 'entered');
fs.readFileSync(${JSON.stringify(fifo)});
fs.writeFileSync(${JSON.stringify(join(f.directory, 'gate-finished'))}, 'finished');
`);
  return fifo;
}

test('receive-pack starts only after awaited validation releases its native barrier', async () => {
  const f = fixture(); sshTransport(f);
  const release = gateBarrier(f);
  const { child, done } = asyncPush(f);
  await waitForFile(join(f.directory, 'gate-entered'), child);
  assert.equal(existsSync(join(f.directory, 'transport-started')), false);
  assert.equal(existsSync(join(f.directory, 'gate-finished')), false);
  writeFileSync(release, 'release');
  const result = await done;
  assert.equal(result.code, 0, result.stderr);
  assert.equal(existsSync(join(f.directory, 'gate-finished')), true);
  assert.equal(existsSync(join(f.directory, 'transport-started')), true);
  assert.equal(f.run(['rev-parse', 'refs/heads/feature'], f.remote).stdout.trim(), f.run(['rev-parse', 'HEAD']).stdout.trim());
});

test('failed validation never opens SSH receive-pack', () => {
  const f = fixture(); sshTransport(f); f.env.FIXTURE_GATE_EXIT = '7';
  const result = f.push();
  assert.notEqual(result.status, 0);
  assert.equal(existsSync(join(f.directory, 'transport-started')), false);
  assert.notEqual(f.run(['rev-parse', '--verify', 'refs/heads/feature'], f.remote).status, 0);
});

test('a native transport close after admission reports failure without publishing', async () => {
  const f = fixture(); sshTransport(f);
  const fifo = join(f.directory, 'hook-release');
  assert.equal(spawnSync('mkfifo', [fifo]).status, 0);
  const hook = readFileSync(join(f.repo, '.husky/pre-push'), 'utf8');
  writeFileSync(join(f.repo, '.husky/pre-push'), hook.replace('exit $?\n', `echo admitted > '${join(f.directory, 'hook-admitted')}'\ncat '${fifo}' >/dev/null\nexit 0\n`));
  commitFixture(f);
  const { child, done } = asyncPush(f);
  await waitForFile(join(f.directory, 'hook-admitted'), child);
  const receiver = Number(readFileSync(join(f.directory, 'receiver-pid'), 'utf8'));
  process.kill(receiver, 'SIGTERM');
  await waitForFile(join(f.directory, 'transport-closed'), child);
  writeFileSync(fifo, 'release');
  const result = await done;
  assert.notEqual(result.code, 0);
  assert.notEqual(f.run(['rev-parse', '--verify', 'refs/heads/feature'], f.remote).status, 0);
  assert.equal(existsSync(join(f.repo, '.git/gate-in-progress')), false);
});

test('an already current explicit destination still consumes its live admission', () => {
  const f = fixture();
  assert.equal(f.push(['test']).status, 0);
  const repeated = f.push(['test']);
  assert.equal(repeated.status, 0, repeated.stderr);
  assert.equal(readFileSync(join(f.directory, 'checks'), 'utf8'), 'gate --no-build --no-test\ngate --no-build --no-test\n');
});

test('each configured push URL receives a separate one-use admission', () => {
  const f = fixture(); const second = join(f.directory, 'second.git');
  assert.equal(f.run(['init', '--bare', second], f.directory).status, 0);
  assert.equal(f.run(['remote', 'set-url', '--add', '--push', 'origin', f.remote]).status, 0);
  assert.equal(f.run(['remote', 'set-url', '--add', '--push', 'origin', second]).status, 0);
  const result = f.push();
  assert.equal(result.status, 0, result.stderr);
  for (const remote of [f.remote, second]) {
    assert.equal(f.run(['rev-parse', 'refs/heads/feature'], remote).stdout.trim(), f.run(['rev-parse', 'HEAD']).stdout.trim());
  }
  assert.equal(readFileSync(join(f.directory, 'checks'), 'utf8'), 'gate --phase=1 --changed\n');
});

for (const [name, input, remoteUrl] of [
  ['destination and gate strength', '"$SHA $SHA refs/heads/test $ZERO"', '"$2"'],
  ['different source', '"$SHA $ZERO refs/heads/feature $ZERO"', '"$2"'],
  ['extra branch', '"$SHA $SHA refs/heads/feature $ZERO" "$SHA $SHA refs/heads/test $ZERO"', '"$2"'],
  ['wrong remote URL', '"$SHA $SHA refs/heads/feature $ZERO"', '"${2}-forged"'],
]) {
  test(`live admission rejects ${name}`, () => {
    const f = fixture();
    replaceHook(f, `cat >/dev/null\nSHA=$(git rev-parse HEAD)\nZERO=0000000000000000000000000000000000000000\nprintf '%s\\n' ${input} | node scripts/git-hooks/push-admission.cjs verify "$1" ${remoteUrl}`);
    const result = f.push();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Admission does not cover these exact refs|Wrong or replayed push admission/);
    assert.equal(readFileSync(join(f.directory, 'checks'), 'utf8'), 'gate --phase=1 --changed\n');
    assert.notEqual(f.run(['rev-parse', '--verify', 'refs/heads/feature'], f.remote).status, 0);
    assert.notEqual(f.run(['rev-parse', '--verify', 'refs/heads/test'], f.remote).status, 0);
  });
}

test('the same live channel cannot replay a previously consumed admission', () => {
  const f = fixture();
  replaceHook(f, 'REFS=$(cat)\nnode scripts/git-hooks/push-admission.cjs verify "$@" <<< "$REFS"\nnode scripts/git-hooks/push-admission.cjs verify "$@" <<< "$REFS"');
  const result = f.push();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /replayed/i);
  assert.notEqual(f.run(['rev-parse', '--verify', 'refs/heads/feature'], f.remote).status, 0);
});

test('a dead producer and persisted receipt cannot admit a direct push', () => {
  const f = fixture();
  writeFileSync(join(f.repo, '.git/gate-in-progress'), '2147483647\n');
  writeFileSync(join(f.repo, '.git/push-admission.json'), JSON.stringify({ approved: true, head: f.run(['rev-parse', 'HEAD']).stdout.trim() }));
  const result = f.run(['push', 'origin', 'HEAD:refs/heads/feature']);
  assert.notEqual(result.status, 0);
  assert.equal(existsSync(join(f.directory, 'checks')), false);
});

for (const mode of ['plain', 'node-title', 'bash-c', 'exec-argv', 'wrapper-title']) {
test(`a forged live issuer (${mode}) cannot admit a direct push`, () => {
  const f = fixture(); const script = join(f.directory, 'forged-owner.cjs');
  writeFileSync(script, `const fs = require('node:fs');
const { spawn, spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
if (${mode === 'node-title'}) process.title = ${JSON.stringify(`${process.execPath} ${join(f.repo, 'scripts/git-hooks/push-admission.cjs')} owner feature origin`)};
const checkout = fs.openSync('.git/prepush-admission.lock', 'a');
const global = fs.openSync(${JSON.stringify(join(f.directory, `revealui-push-${process.getuid()}.lock`))}, 'a');
for (const fd of [checkout, global]) {
  if (spawnSync('flock', ['--exclusive', '--nonblock', '3'], { stdio: ['ignore','ignore','ignore',fd] }).status !== 0) process.exit(2);
}
fs.writeFileSync('.git/gate-in-progress', String(process.pid));
const git = spawn('git', ['push', 'origin', 'HEAD:refs/heads/feature'], {
  stdio: ['ignore','inherit','inherit','pipe','ignore','ignore','ignore','ignore',checkout,global],
});
git.stdio[3].setEncoding('utf8');
git.stdio[3].on('data', (data) => {
  fs.writeFileSync(${JSON.stringify(join(f.directory, 'forged-request'))}, data);
  const request = JSON.parse(data);
  git.stdio[3].write(JSON.stringify({ version:1, nonce:request.nonce,
    request:createHash('sha256').update(JSON.stringify(request)).digest('hex'), approved:true }) + '\\n');
});
git.once('exit', (code) => process.exit(code ?? 1));
`);
  let program = process.execPath;
  let args = [script, 'argv-capacity-'.repeat(100)];
  const shellQuote = (value) => "'" + value.replaceAll("'", "'\"'\"'") + "'";
  if (mode === 'bash-c' || mode === 'exec-argv') {
    program = '/bin/bash';
    const node = shellQuote(process.execPath);
    const issuer = shellQuote(script);
    args = ['-p', '-c', `${node} ${issuer} ${shellQuote('argv-capacity-'.repeat(100))}; exit $?`];
    if (mode === 'exec-argv') {
      program = '/bin/bash';
      args = ['-p', '-c', `exec -a ${shellQuote('/bin/bash -p ' + join(f.repo, 'scripts/git-hooks/push.sh') + ' feature origin')} /bin/bash -p -c ${shellQuote(`${node} ${issuer}; exit $?`)}`];
    }
  } else if (mode === 'wrapper-title') {
    const wrapper = join(f.directory, 'forged-wrapper.cjs');
    writeFileSync(wrapper, `process.title = ${JSON.stringify('/bin/bash -p ' + join(f.repo, 'scripts/git-hooks/push.sh') + ' feature origin')};
const { spawnSync } = require('node:child_process');
const result = spawnSync(process.execPath, [${JSON.stringify(script)}], { stdio:'inherit' });
process.exit(result.status ?? 1);
`);
    args = [wrapper, 'argv-capacity-'.repeat(100)];
  }
  const result = spawnSync(program, args, { cwd: f.repo, env: f.env, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /producer is not the maintained push owner|canonical Bash owner/);
  assert.equal(existsSync(join(f.directory, 'forged-request')), false, 'reject a counterfeit producer before sending a challenge');
  assert.equal(existsSync(join(f.directory, 'checks')), false);
  assert.notEqual(f.run(['rev-parse', '--verify', 'refs/heads/feature'], f.remote).status, 0);
});

}

test('disabled or unsupported hooks fail before gates and transport', () => {
  for (const mode of ['disabled', 'unsupported', 'non-executable']) {
    const f = fixture(); sshTransport(f);
    if (mode === 'disabled') f.env.HUSKY = '0';
    else if (mode === 'unsupported') assert.equal(f.run(['config', 'core.hooksPath', '.git/hooks']).status, 0);
    else chmodSync(join(f.repo, '.husky/_/pre-push'), 0o644);
    const result = f.push();
    assert.notEqual(result.status, 0);
    assert.equal(existsSync(join(f.directory, 'checks')), false);
    assert.equal(existsSync(join(f.directory, 'transport-started')), false);
  }
});

test('changing the configured remote during validation prevents any transport', () => {
  const f = fixture(); sshTransport(f);
  writeFileSync(join(f.directory, 'bin/pnpm'), '#!/bin/sh\ngit remote set-url origin /unsupported/changed.git\n');
  const result = f.push();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /remote changed during validation/);
  assert.equal(existsSync(join(f.directory, 'transport-started')), false);
});

test('maintained cache cleanup preserves aged saved work and held admission inodes', async () => {
  const f = fixture();
  // This directory belongs solely to this fixture but matches a former global
  // deletion glob. Never populate or reclaim another session's fixed paths.
  const saved = mkdtempSync(join(tmpdir(), 'revealui-push-stash-fixture-'));
  writeFileSync(join(saved, 'evidence'), 'saved work');
  utimesSync(saved, new Date(0), new Date(0));
  const lock = join(f.directory, `revealui-push-${process.getuid()}.lock`);
  const holder = spawn('flock', [lock, 'sh', '-c', 'echo ready; cat >/dev/null'], { env: f.env, stdio: ['pipe', 'pipe', 'pipe'] });
  const exited = new Promise((resolve) => holder.once('exit', resolve));
  await new Promise((resolve, reject) => { holder.stdout.once('data', resolve); holder.once('error', reject); });
  utimesSync(lock, new Date(0), new Date(0));
  mkdirSync(join(f.repo, '.turbo')); writeFileSync(join(f.repo, '.turbo/cache'), 'cache');
  mkdirSync(join(f.repo, 'apps/admin/.next/cache'), { recursive: true });
  writeFileSync(join(f.repo, 'apps/admin/.next/cache/value'), 'cache');
  const unknown = join(f.directory, 'claude-session-saved'); writeFileSync(unknown, 'retain');
  try {
    const result = spawnSync('bash', [join(root, 'scripts/git-hooks/cleanup.sh')], { cwd: f.repo, env: f.env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(join(saved, 'evidence'), 'utf8'), 'saved work');
    assert.equal(readFileSync(unknown, 'utf8'), 'retain');
    assert.equal(existsSync(join(f.repo, '.turbo')), false);
    assert.equal(existsSync(join(f.repo, 'apps/admin/.next/cache')), false);
    assert.notEqual(spawnSync('flock', ['--nonblock', lock, 'true']).status, 0);
  } finally { holder.stdin.end(); await exited; }
  assert.equal(existsSync(lock), true);
});

test('a clean new commit created during validation is preserved but not published', () => {
  const f = fixture(); const before = f.run(['rev-parse', 'HEAD']).stdout.trim();
  writeFileSync(join(f.directory, 'bin/pnpm'), '#!/bin/sh\necho committed >> tracked\ngit add tracked\ngit -c user.name=Fixture -c user.email=fixture@example.invalid commit -m new-source\n');
  const result = f.push();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Source changed during validation/);
  assert.notEqual(f.run(['rev-parse', 'HEAD']).stdout.trim(), before);
  assert.equal(f.run(['status', '--porcelain']).stdout, '');
  assert.notEqual(f.run(['rev-parse', '--verify', 'refs/heads/feature'], f.remote).status, 0);
});

test('a failed challenge cannot be ignored and followed by a valid retry', () => {
  const f = fixture();
  replaceHook(f, 'REFS=$(cat)\nnode scripts/git-hooks/push-admission.cjs verify "$1" "${2}-wrong" <<< "$REFS" || true\nnode scripts/git-hooks/push-admission.cjs verify "$@" <<< "$REFS"');
  const result = f.push();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Wrong or replayed push admission/);
  assert.notEqual(f.run(['rev-parse', '--verify', 'refs/heads/feature'], f.remote).status, 0);
});

test('a changed remote after transport opens invalidates the exact admission', () => {
  const f = fixture();
  replaceHook(f, 'REFS=$(cat)\ngit remote set-url origin /changed/remote.git\nnode scripts/git-hooks/push-admission.cjs verify "$@" <<< "$REFS"');
  const result = f.push();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Push remote changed after validation/);
  assert.notEqual(f.run(['rev-parse', '--verify', 'refs/heads/feature'], f.remote).status, 0);
});

test('duplicate configured URLs fail before validation and transport', () => {
  const f = fixture(); sshTransport(f);
  const url = f.run(['remote', 'get-url', 'origin']).stdout.trim();
  assert.equal(f.run(['remote', 'set-url', '--add', '--push', 'origin', url]).status, 0);
  assert.equal(f.run(['remote', 'set-url', '--add', '--push', 'origin', url]).status, 0);
  const result = f.push();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Duplicate push URLs/);
  assert.equal(existsSync(join(f.directory, 'checks')), false);
  assert.equal(existsSync(join(f.directory, 'transport-started')), false);
});


test('ignored untracked admission code cannot claim a committed source tree', () => {
  const f = fixture();
  assert.equal(f.run(['rm', '--cached', 'scripts/git-hooks/push-admission.cjs']).status, 0);
  writeFileSync(join(f.repo, '.gitignore'), readFileSync(join(f.repo, '.gitignore'), 'utf8') + 'scripts/git-hooks/push-admission.cjs\n');
  commitFixture(f);
  assert.equal(f.run(['status', '--porcelain']).stdout, '');
  const result = f.push();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /did not match any file/);
  assert.equal(existsSync(join(f.directory, 'checks')), false);
  assert.notEqual(f.run(['rev-parse', '--verify', 'refs/heads/feature'], f.remote).status, 0);
});


test('shell startup files and imported functions fail closed before gate or transport', () => {
  for (const mode of ['BASH_ENV', 'ENV', 'function']) {
    const f = fixture(); sshTransport(f);
    const injected = join(f.directory, 'bash-startup');
    writeFileSync(injected, `echo injected > '${join(f.directory, 'startup-ran')}'\nexit 0\n`);
    if (mode === 'function') f.env['BASH_FUNC_git%%'] = '() { echo forged; }';
    else f.env[mode] = injected;
    const result = f.push();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /startup injection is unsupported/);
    assert.equal(existsSync(join(f.directory, 'startup-ran')), false);
    assert.equal(existsSync(join(f.directory, 'checks')), false);
    assert.equal(existsSync(join(f.directory, 'transport-started')), false);
    assert.notEqual(f.run(['rev-parse', '--verify', 'refs/heads/feature'], f.remote).status, 0);
  }
});

test('Node startup injection is rejected before any Node helper, gate or transport starts', () => {
  const f = fixture(); sshTransport(f);
  const injected = join(f.directory, 'node-preload.cjs');
  writeFileSync(injected, `require('node:fs').writeFileSync(${JSON.stringify(join(f.directory, 'preload-ran'))}, 'injected');`);
  f.env.NODE_OPTIONS = `--require ${injected}`;
  const result = f.push();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /startup injection is unsupported/);
  assert.equal(existsSync(join(f.directory, 'preload-ran')), false);
  assert.equal(existsSync(join(f.directory, 'checks')), false);
  assert.equal(existsSync(join(f.directory, 'transport-started')), false);
});

test('direct Git cannot preload the verifier to forge acceptance', () => {
  const f = fixture(); const injected = join(f.directory, 'verifier-preload.cjs');
  writeFileSync(injected, `require('node:fs').writeFileSync(${JSON.stringify(join(f.directory, 'verifier-preload-ran'))}, 'forged'); process.exit(0);`);
  f.env.NODE_OPTIONS = `--require ${injected}`;
  const result = f.run(['push', 'origin', 'HEAD:refs/heads/feature']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /startup injection is unsupported/);
  assert.equal(existsSync(join(f.directory, 'verifier-preload-ran')), false);
  assert.equal(existsSync(join(f.directory, 'checks')), false);
  assert.notEqual(f.run(['rev-parse', '--verify', 'refs/heads/feature'], f.remote).status, 0);
});
