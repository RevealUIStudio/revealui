/** Coordinated push admission. Gates complete before Git opens receive-pack. */
const { spawn, spawnSync } = require('node:child_process');
const { createHash, randomBytes } = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

const IMPLEMENTATION = fs.realpathSync(__filename);
const IMPLEMENTATION_HASH = hash(fs.readFileSync(IMPLEMENTATION));
const CHANNEL_DEADLINE_MS = 10000;
const MAX_PACKET_BYTES = 65536;
let runningChild;
let interrupted;

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function command(program, args, options = {}) {
  const result = spawnSync(program, args, { encoding: 'utf8', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${program} failed (${result.signal || result.status}): ${result.stderr.trim()}`);
  return result.stdout.trim();
}

function git(args) {
  return command('git', args);
}

function gateArgs(target) {
  return target === 'main' || target === 'test'
    ? ['gate', '--no-build', '--no-test']
    : ['gate', '--phase=1', '--changed'];
}

function snapshot() {
  const root = fs.realpathSync(git(['rev-parse', '--show-toplevel']));
  const gitDir = fs.realpathSync(git(['rev-parse', '--absolute-git-dir']));
  const head = git(['rev-parse', 'HEAD']);
  const tree = git(['rev-parse', 'HEAD^{tree}']);
  const branch = git(['symbolic-ref', '--quiet', '--short', 'HEAD']);
  git(['ls-files', '--error-unmatch', '--',
    'scripts/git-hooks/push-admission.cjs', 'scripts/git-hooks/push.sh', '.husky/pre-push']);
  if (git(['status', '--porcelain', '--untracked-files=all'])) {
    throw new Error('Clean index and worktree required; all uncommitted work is preserved.');
  }
  if (fs.realpathSync(path.join(root, 'scripts/git-hooks/push-admission.cjs')) !== IMPLEMENTATION) {
    throw new Error('Push admission must use this checkout’s maintained implementation.');
  }
  if (hash(fs.readFileSync(IMPLEMENTATION)) !== IMPLEMENTATION_HASH) {
    throw new Error('Push admission implementation changed during validation.');
  }
  return { root, gitDir, head, tree, branch, implementation: IMPLEMENTATION_HASH };
}

function remoteUrls(remote) {
  return git(['remote', 'get-url', '--push', '--all', '--', remote]).split('\n');
}

function equal(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function exactRecord(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && equal(Object.keys(value).sort(), [...keys].sort());
}

function assertSnapshot(expected) {
  if (!equal(snapshot(), expected)) throw new Error('Source changed during validation; all work is preserved.');
}

function installedHook(root) {
  if (process.env.HUSKY === '0') throw new Error('Disabled hooks cannot publish through coordinated push.');
  const hooks = fs.realpathSync(git(['rev-parse', '--git-path', 'hooks']));
  if (hooks !== fs.realpathSync(path.join(root, '.husky/_'))) {
    throw new Error('Maintained Husky hooks are required. Initialize the checkout with pnpm install.');
  }
  const shim = fs.readFileSync(path.join(hooks, 'pre-push'), 'utf8');
  if (!(fs.statSync(path.join(hooks, 'pre-push')).mode & 0o111)) {
    throw new Error('Executable Husky pre-push bootstrap required; initialize with pnpm install.');
  }
  if (shim !== '#!/usr/bin/env sh\n. "$(dirname "$0")/h"') {
    throw new Error('Unexpected pre-push bootstrap; initialize the checkout with pnpm install.');
  }
  if (!fs.readFileSync(path.join(hooks, 'h')).equals(fs.readFileSync(path.join(root, 'node_modules/husky/husky')))) {
    throw new Error('Unexpected Husky runtime; initialize the checkout with pnpm install.');
  }
}

function leasePath(uid) {
  return path.join(os.tmpdir(), `revealui-push-${uid}.lock`);
}

function leaseStdio(checkout, global, channel = 'ignore') {
  return ['inherit', 'inherit', 'inherit', channel, 'ignore', 'ignore', 'ignore', 'ignore', checkout, global];
}

async function child(program, args, stdio, started) {
  const processChild = spawn(program, args, { stdio });
  runningChild = processChild;
  if (started) started(processChild);
  try {
    return await new Promise((resolve, reject) => {
      processChild.once('error', reject);
      processChild.once('exit', (code, signal) => resolve({ code, signal }));
    });
  } finally {
    runningChild = undefined;
  }
}

function packets(socket, receive, failed) {
  let buffered = '';
  socket.setEncoding('utf8');
  socket.on('error', failed);
  socket.on('data', (data) => {
    buffered += data;
    if (Buffer.byteLength(buffered) > MAX_PACKET_BYTES) return failed(new Error('Admission packet too large.'));
    let boundary;
    while ((boundary = buffered.indexOf('\n')) !== -1) {
      const packet = buffered.slice(0, boundary);
      buffered = buffered.slice(boundary + 1);
      try { receive(JSON.parse(packet)); } catch (error) { failed(error); }
    }
  });
}

function parentPid(pid) {
  const line = fs.readFileSync(`/proc/${pid}/status`, 'utf8')
    .split('\n').find((value) => value.startsWith('PPid:'));
  const parent = Number(line?.slice('PPid:'.length).trim());
  if (!Number.isSafeInteger(parent) || parent < 1) throw new Error('Cannot establish live push ancestry.');
  return parent;
}

function ancestryContains(pid, ancestor) {
  for (let depth = 0; depth < 32 && pid > 1; depth += 1) {
    if (pid === ancestor) return true;
    pid = parentPid(pid);
  }
  return false;
}

function sameExecutable(pid, executable) {
  const actual = fs.statSync(`/proc/${pid}/exe`);
  const expected = fs.statSync(executable);
  return actual.dev === expected.dev && actual.ino === expected.ino;
}

function producerTarget(pid, source, remote) {
  process.kill(pid, 0);
  const wrapper = parentPid(pid);
  const argv = fs.readFileSync(`/proc/${wrapper}/cmdline`, 'utf8').split('\0');
  if (argv.at(-1) === '') argv.pop();
  if (!sameExecutable(pid, process.execPath) || !sameExecutable(wrapper, '/bin/bash')
    || argv.length !== 5 || argv[0] !== '/bin/bash' || argv[1] !== '-p'
    || argv[2] !== path.join(source.root, 'scripts/git-hooks/push.sh')
    || !argv[3] || argv[4] !== remote || parentPid(pid) !== wrapper) {
    throw new Error('Admission producer lacks the canonical Bash owner.');
  }
  if (!ancestryContains(process.pid, pid)) throw new Error('Admission does not belong to this Git invocation.');
  return argv[3];
}

function assertInheritedLease(descriptor, filename) {
  const actual = fs.fstatSync(descriptor);
  const expected = fs.statSync(filename);
  if (actual.dev !== expected.dev || actual.ino !== expected.ino) throw new Error('Admission lease is not inherited.');
  const probe = spawnSync('flock', ['--exclusive', '--nonblock', '--conflict-exit-code', '75', filename, 'true']);
  if (probe.error) throw probe.error;
  if (probe.status !== 75) throw new Error('Admission lease is not live.');
}

function readRefs(input) {
  if (Buffer.byteLength(input) > MAX_PACKET_BYTES) throw new Error('Push ref request too large.');
  return input.split('\n').filter(Boolean).map((line) => {
    const fields = line.trim().split(/\s+/);
    if (fields.length !== 4) throw new Error('Malformed Git ref request.');
    const [localRef, localSha, remoteRef, remoteSha] = fields;
    if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(localSha) || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(remoteSha)) {
      throw new Error('Malformed Git object identity.');
    }
    return { localRef, localSha, remoteRef, remoteSha };
  });
}

async function owner(args) {
  if (args.length !== 2) throw new Error('Use the maintained pnpm push entry point.');
  if (process.platform !== 'linux' || !process.getuid) {
    throw new Error('Coordinated push requires Linux/WSL, readable procfs, Node, /bin/bash and flock.');
  }
  if (Object.keys(process.env).some((name) => name.startsWith('BASH_FUNC_'))) {
    throw new Error('Imported shell function startup injection is unsupported for push admission.');
  }
  const global = fs.openSync(leasePath(process.getuid()), 'a', 0o600);
  let checkout;
  let marker;
  let channel;
  try {
    console.log('Waiting for coordinated push admission...');
    const acquired = await child('flock', ['--exclusive', '--wait', '300', '3'], ['inherit', 'inherit', 'inherit', global]);
    if (acquired.code !== 0 || interrupted) throw new Error('Coordinated push admission was unavailable or interrupted.');
    const source = snapshot();
    const target = args[0] || source.branch;
    const remote = args[1] || 'origin';
    if (producerTarget(process.pid, source, remote) !== target) throw new Error('Wrong push owner destination.');
    git(['check-ref-format', `refs/heads/${target}`]);
    git(['check-ref-format', `refs/remotes/${remote}/admission`]);
    const urls = remoteUrls(remote);
    if (new Set(urls).size !== urls.length) throw new Error('Duplicate push URLs cannot receive distinct one-use admissions.');
    installedHook(source.root);
    if (!fs.existsSync(path.join(source.root, 'node_modules'))) throw new Error('Dependencies must be initialized with pnpm install.');
    checkout = fs.openSync(path.join(source.gitDir, 'prepush-admission.lock'), 'a', 0o600);
    const admitted = await child('flock', ['--exclusive', '--nonblock', '3'], ['inherit', 'inherit', 'inherit', checkout]);
    if (admitted.code !== 0 || interrupted) throw new Error('Another push owns this checkout or admission was interrupted.');
    marker = path.join(source.gitDir, 'gate-in-progress');
    fs.writeFileSync(marker, `${process.pid}\n`, { mode: 0o600 });
    const gate = gateArgs(target);
    const validated = await child('pnpm', gate, leaseStdio(checkout, global));
    if (validated.code !== 0 || interrupted) throw new Error(`Required validation failed (${validated.signal || validated.code}); nothing published.`);
    assertSnapshot(source);
    if (producerTarget(process.pid, source, remote) !== target) throw new Error('Push owner changed during validation.');
    if (!equal(remoteUrls(remote), urls)) throw new Error('Push remote changed during validation.');
    installedHook(source.root);
    const consumed = new Set();
    let admissionFailure;
    const result = await child('git', ['push', '--', remote, `${source.head}:refs/heads/${target}`], leaseStdio(checkout, global, 'pipe'), (gitChild) => {
      channel = gitChild.stdio[3];
      let pending = Promise.resolve();
      const failed = (error) => { admissionFailure = error; gitChild.kill('SIGTERM'); };
      packets(channel, (request) => {
        pending = pending.then(() => {
          try {
            if (admissionFailure) throw admissionFailure;
            if (!exactRecord(request, ['version', 'nonce', 'owner', 'pid', 'source', 'remote', 'url', 'refs', 'gate'])
              || request.version !== 1 || typeof request.nonce !== 'string' || !/^[a-f0-9]{64}$/.test(request.nonce)
              || typeof request.refs !== 'string') throw new Error('Invalid admission challenge.');
            if (request.owner !== process.pid || !Number.isSafeInteger(request.pid) || !ancestryContains(request.pid, gitChild.pid)) throw new Error('Admission caller is not this Git child.');
            if (!equal(request.source, source) || request.remote !== remote || !urls.includes(request.url) || consumed.has(request.url)) throw new Error('Wrong or replayed push admission.');
            const refs = readRefs(request.refs);
            if (refs.length !== 0 && (refs.length !== 1 || refs[0].localRef !== source.head || refs[0].localSha !== source.head || refs[0].remoteRef !== `refs/heads/${target}`)) throw new Error('Admission does not cover these exact refs.');
            if (!equal(request.gate, gate)) throw new Error('Admission does not cover the required gate strength.');
            if (producerTarget(process.pid, source, remote) !== target) throw new Error('Push owner is no longer live.');
            assertSnapshot(source);
            if (!equal(remoteUrls(remote), urls)) throw new Error('Push remote changed after validation.');
            consumed.add(request.url);
            channel.write(`${JSON.stringify({ version: 1, nonce: request.nonce, request: hash(JSON.stringify(request)), approved: true })}\n`);
          } catch (error) {
            admissionFailure = error;
            channel.write(`${JSON.stringify({ version: 1, nonce: request?.nonce, approved: false, error: error.message })}\n`, () => gitChild.kill('SIGTERM'));
          }
        }).catch(failed);
      }, failed);
    });
    if (result.code !== 0 || interrupted || admissionFailure) throw new Error(`Git push failed (${result.signal || result.code}); ${admissionFailure?.message || 'publication must be checked from the remote result.'}`);
    if (consumed.size !== urls.length) throw new Error('Git did not consume its live pre-push admission.');
  } finally {
    channel?.destroy();
    if (marker && fs.existsSync(marker) && fs.readFileSync(marker, 'utf8') === `${process.pid}\n`) fs.unlinkSync(marker);
    if (checkout !== undefined) fs.closeSync(checkout);
    fs.closeSync(global);
  }
}

async function verify(args) {
  if (args.length !== 2) throw new Error('Expected Git’s remote name and URL.');
  const [remote, url] = args;
  const refsText = fs.readFileSync(0, 'utf8');
  readRefs(refsText);
  const source = snapshot();
  const marker = path.join(source.gitDir, 'gate-in-progress');
  const ownerPid = Number(fs.readFileSync(marker, 'utf8').trim());
  if (!Number.isSafeInteger(ownerPid) || ownerPid < 1) throw new Error('Missing live push admission.');
  const target = producerTarget(ownerPid, source, remote);
  git(['check-ref-format', `refs/heads/${target}`]);
  assertInheritedLease(8, path.join(source.gitDir, 'prepush-admission.lock'));
  assertInheritedLease(9, leasePath(process.getuid()));
  const request = { version: 1, nonce: randomBytes(32).toString('hex'), owner: ownerPid, pid: process.pid, source, remote, url, refs: refsText, gate: gateArgs(target) };
  const socket = new net.Socket({ fd: 3, readable: true, writable: true });
  try {
    await new Promise((resolve, reject) => {
      const deadline = setTimeout(() => reject(new Error('Live push admission did not respond in time.')), CHANNEL_DEADLINE_MS);
      const finish = (error) => { clearTimeout(deadline); error ? reject(error) : resolve(); };
      socket.once('end', () => finish(new Error('Push admission owner closed the channel.')));
      packets(socket, (response) => {
        if (!exactRecord(response, ['version', 'nonce', 'request', 'approved'])
          || response.version !== 1 || response.nonce !== request.nonce || response.request !== hash(JSON.stringify(request)) || response.approved !== true) {
          return finish(new Error(response?.error || 'Forged or denied push admission.'));
        }
        finish();
      }, finish);
      socket.write(`${JSON.stringify(request)}\n`);
    });
  } finally {
    socket.destroy();
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => { interrupted = signal; runningChild?.kill(signal); });
}

async function main() {
  const [mode, ...args] = process.argv.slice(2);
  if (mode === 'owner') await owner(args);
  else if (mode === 'verify') await verify(args);
  else throw new Error('Unsupported push admission invocation.');
}

main().catch((error) => {
  console.error(`Push denied: ${error.message}\nUse pnpm push [target-branch [remote]] for maintained validation before transport.`);
  process.exitCode = 1;
});
