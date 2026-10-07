import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const script = resolve(here, '../../../scripts/ci/server-tsx-boot-smoke.mjs');
const loader = resolve(here, 'fixtures/smoke-native-child.mjs');

it('reaps an owned native child that ignores TERM before reporting smoke success', () => {
  const result = spawnSync(process.execPath, ['--import', loader, script], {
    encoding: 'utf8',
    timeout: 20_000,
    env: { ...process.env, NODE_ENV: 'test' },
  });
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr + result.stdout).toBe(0);
  const line = result.stdout.split('\n').find((item) => item.startsWith('OWNED_CHILD_RECEIPT:'));
  expect(line, result.stderr + result.stdout).toBeDefined();
  const receipt = JSON.parse(line!.slice('OWNED_CHILD_RECEIPT:'.length));
  expect(receipt).toMatchObject({ closed: true, successAfterClose: true });
  expect(receipt.signals).toEqual(['SIGTERM', 'SIGKILL']);
}, 25_000);

it('reports a signal-only child exit as an early boot failure', () => {
  const result = spawnSync(
    process.execPath,
    ['--import', resolve(here, 'fixtures/smoke-inert-child.mjs'), script],
    {
      encoding: 'utf8',
      timeout: 5000,
      env: { ...process.env, NODE_ENV: 'test' },
    },
  );
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr + result.stdout).toBe(1);
  expect(result.stderr).toContain('server exited early');
  expect(result.stderr).toContain('signal SIGTERM');
  expect(result.stderr).not.toContain('timed out');
  expect(result.stdout).not.toContain('server-tsx-boot-smoke: OK');
});

it('reports spawn failure through the CLI after confirming child closure', () => {
  const result = spawnSync(
    process.execPath,
    ['--import', resolve(here, 'fixtures/smoke-inert-child.mjs'), script],
    {
      encoding: 'utf8',
      timeout: 5000,
      env: { ...process.env, NODE_ENV: 'test', SMOKE_TEST_CASE: 'spawn-error' },
    },
  );
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr + result.stdout).toBe(1);
  expect(result.stderr).toContain('server-tsx-boot-smoke: FAIL synthetic child spawn failure');
  const line = result.stdout.split('\n').find((item) => item.startsWith('INERT_CHILD_RECEIPT:'));
  expect(line, result.stderr + result.stdout).toBeDefined();
  expect(JSON.parse(line!.slice('INERT_CHILD_RECEIPT:'.length))).toMatchObject({
    closed: true,
    signals: [],
  });
  expect(result.stdout).not.toContain('server-tsx-boot-smoke: OK');
});

it('refuses a successful health response after its child has failed to spawn', () => {
  const result = spawnSync(
    process.execPath,
    ['--import', resolve(here, 'fixtures/smoke-inert-child.mjs'), script],
    {
      encoding: 'utf8',
      timeout: 5000,
      env: { ...process.env, NODE_ENV: 'test', SMOKE_TEST_CASE: 'spawn-error-ready' },
    },
  );
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr + result.stdout).toBe(1);
  expect(result.stderr).toContain('server-tsx-boot-smoke: FAIL synthetic child spawn failure');
  expect(result.stdout).not.toContain('server-tsx-boot-smoke: OK');
});

it('reports a synchronous spawn throw as a controlled smoke failure', () => {
  const result = spawnSync(
    process.execPath,
    ['--import', resolve(here, 'fixtures/smoke-inert-child.mjs'), script],
    {
      encoding: 'utf8',
      timeout: 5000,
      env: { ...process.env, NODE_ENV: 'test', SMOKE_TEST_CASE: 'spawn-throw' },
    },
  );
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr + result.stdout).toBe(1);
  expect(result.stderr).toContain(
    'server-tsx-boot-smoke: FAIL synthetic synchronous spawn failure',
  );
  expect(result.stdout).not.toContain('server-tsx-boot-smoke: OK');
});

it('cancels pending health on SIGTERM and closes the owned child before failing', () => {
  const result = spawnSync(
    process.execPath,
    ['--import', resolve(here, 'fixtures/smoke-inert-child.mjs'), script],
    {
      encoding: 'utf8',
      timeout: 5000,
      env: { ...process.env, NODE_ENV: 'test', SMOKE_TEST_CASE: 'cancel-pending' },
    },
  );
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr + result.stdout).toBe(1);
  expect(result.stderr).toContain('server-tsx-boot-smoke: FAIL smoke interrupted by SIGTERM');
  const line = result.stdout.split('\n').find((item) => item.startsWith('INERT_CHILD_RECEIPT:'));
  expect(line, result.stderr + result.stdout).toBeDefined();
  expect(JSON.parse(line!.slice('INERT_CHILD_RECEIPT:'.length))).toMatchObject({
    closed: true,
    signals: ['SIGTERM'],
    fetchAborted: true,
  });
  expect(result.stdout).not.toContain('server-tsx-boot-smoke: OK');
});

it('enforces the boot deadline while a health request is still pending', () => {
  const result = spawnSync(
    process.execPath,
    ['--import', resolve(here, 'fixtures/smoke-inert-child.mjs'), script],
    {
      encoding: 'utf8',
      timeout: 5000,
      env: { ...process.env, NODE_ENV: 'test', SMOKE_TEST_CASE: 'deadline-pending' },
    },
  );
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr + result.stdout).toBe(1);
  expect(result.stderr).toContain('server-tsx-boot-smoke: FAIL timed out waiting for');
  expect(result.stderr).toContain('after 90000ms');
  const line = result.stdout.split('\n').find((item) => item.startsWith('INERT_CHILD_RECEIPT:'));
  expect(line, result.stderr + result.stdout).toBeDefined();
  expect(JSON.parse(line!.slice('INERT_CHILD_RECEIPT:'.length))).toMatchObject({
    closed: true,
    signals: ['SIGTERM'],
    fetchAborted: true,
  });
  expect(result.stdout).not.toContain('server-tsx-boot-smoke: OK');
});

it('aborts pending health immediately when its child emits an error', () => {
  const result = spawnSync(
    process.execPath,
    ['--import', resolve(here, 'fixtures/smoke-inert-child.mjs'), script],
    {
      encoding: 'utf8',
      timeout: 5000,
      env: { ...process.env, NODE_ENV: 'test', SMOKE_TEST_CASE: 'error-pending' },
    },
  );
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr + result.stdout).toBe(1);
  expect(result.stderr).toContain(
    'server-tsx-boot-smoke: FAIL synthetic child failure during health',
  );
  expect(result.stderr).not.toContain('timed out');
  const line = result.stdout.split('\n').find((item) => item.startsWith('INERT_CHILD_RECEIPT:'));
  expect(line, result.stderr + result.stdout).toBeDefined();
  expect(JSON.parse(line!.slice('INERT_CHILD_RECEIPT:'.length))).toMatchObject({
    closed: true,
    signals: [],
    fetchAborted: true,
  });
  expect(result.stdout).not.toContain('server-tsx-boot-smoke: OK');
});

it('aborts pending health immediately when its child exits by signal', () => {
  const result = spawnSync(
    process.execPath,
    ['--import', resolve(here, 'fixtures/smoke-inert-child.mjs'), script],
    {
      encoding: 'utf8',
      timeout: 5000,
      env: { ...process.env, NODE_ENV: 'test', SMOKE_TEST_CASE: 'exit-pending' },
    },
  );
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr + result.stdout).toBe(1);
  expect(result.stderr).toContain('server exited early with signal SIGTERM');
  expect(result.stderr).not.toContain('timed out');
  const line = result.stdout.split('\n').find((item) => item.startsWith('INERT_CHILD_RECEIPT:'));
  expect(line, result.stderr + result.stdout).toBeDefined();
  expect(JSON.parse(line!.slice('INERT_CHILD_RECEIPT:'.length))).toMatchObject({
    closed: true,
    signals: [],
    fetchAborted: true,
  });
  expect(result.stdout).not.toContain('server-tsx-boot-smoke: OK');
});

it('fails after confirmed cleanup when SIGINT arrives during shutdown', () => {
  const result = spawnSync(
    process.execPath,
    ['--import', resolve(here, 'fixtures/smoke-inert-child.mjs'), script],
    {
      encoding: 'utf8',
      timeout: 5000,
      env: { ...process.env, NODE_ENV: 'test', SMOKE_TEST_CASE: 'cancel-cleanup' },
    },
  );
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr + result.stdout).toBe(1);
  expect(result.stderr).toContain('server-tsx-boot-smoke: FAIL smoke interrupted by SIGINT');
  const line = result.stdout.split('\n').find((item) => item.startsWith('INERT_CHILD_RECEIPT:'));
  expect(line, result.stderr + result.stdout).toBeDefined();
  expect(JSON.parse(line!.slice('INERT_CHILD_RECEIPT:'.length))).toMatchObject({
    closed: true,
    signals: ['SIGTERM'],
  });
  expect(result.stdout).not.toContain('server-tsx-boot-smoke: OK');
});

it('bounds failure completion when a native child rejects both kill requests', () => {
  const result = spawnSync(process.execPath, ['--import', loader, script], {
    encoding: 'utf8',
    timeout: 20_000,
    env: { ...process.env, NODE_ENV: 'test', SMOKE_NATIVE_CASE: 'kill-false' },
  });
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr + result.stdout).toBe(1);
  expect(result.stderr).toContain('server child shutdown was not confirmed');
  const line = result.stdout.split('\n').find((item) => item.startsWith('OWNED_CHILD_RECEIPT:'));
  expect(line, result.stderr + result.stdout).toBeDefined();
  expect(JSON.parse(line!.slice('OWNED_CHILD_RECEIPT:'.length))).toMatchObject({
    reason: 'product-exit',
    closed: false,
    successAfterClose: null,
    signals: ['SIGTERM', 'SIGKILL'],
  });
  expect(result.stdout).not.toContain('server-tsx-boot-smoke: OK');
}, 25_000);

it.each([
  'cleanup-ready-false',
  'cleanup-ready-throw',
  'cleanup-ready-ignored',
  'cleanup-error-false',
  'cleanup-error-throw',
  'cleanup-error-ignored',
])('refuses unconfirmed cleanup for %s while preserving any primary failure', (scenario) => {
  const result = spawnSync(
    process.execPath,
    ['--import', resolve(here, 'fixtures/smoke-inert-child.mjs'), script],
    {
      encoding: 'utf8',
      timeout: 5000,
      env: { ...process.env, NODE_ENV: 'test', SMOKE_TEST_CASE: scenario },
    },
  );
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr + result.stdout).toBe(1);
  expect(result.stderr).toContain('server child shutdown was not confirmed');
  if (scenario.includes('-error-'))
    expect(result.stderr).toContain('synthetic primary boot failure');
  const line = result.stdout.split('\n').find((item) => item.startsWith('INERT_CHILD_RECEIPT:'));
  expect(line, result.stderr + result.stdout).toBeDefined();
  expect(JSON.parse(line!.slice('INERT_CHILD_RECEIPT:'.length))).toMatchObject({
    closed: false,
    signals: ['SIGTERM', 'SIGKILL'],
  });
  expect(result.stdout).not.toContain('server-tsx-boot-smoke: OK');
});

it('cancels an active health polling timer immediately on SIGTERM', () => {
  const result = spawnSync(
    process.execPath,
    ['--import', resolve(here, 'fixtures/smoke-inert-child.mjs'), script],
    {
      encoding: 'utf8',
      timeout: 5000,
      env: { ...process.env, NODE_ENV: 'test', SMOKE_TEST_CASE: 'cancel-poll' },
    },
  );
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr + result.stdout).toBe(1);
  expect(result.stderr).toContain('server-tsx-boot-smoke: FAIL smoke interrupted by SIGTERM');
  const line = result.stdout.split('\n').find((item) => item.startsWith('INERT_CHILD_RECEIPT:'));
  expect(line, result.stderr + result.stdout).toBeDefined();
  expect(JSON.parse(line!.slice('INERT_CHILD_RECEIPT:'.length))).toMatchObject({
    closed: true,
    signals: ['SIGTERM'],
    pollCompleted: false,
    pollCancelled: true,
  });
  expect(result.stdout).not.toContain('server-tsx-boot-smoke: OK');
});

it('rejects an observed child close while its health request is still pending', () => {
  const result = spawnSync(
    process.execPath,
    ['--import', resolve(here, 'fixtures/smoke-inert-child.mjs'), script],
    {
      encoding: 'utf8',
      timeout: 5000,
      env: { ...process.env, NODE_ENV: 'test', SMOKE_TEST_CASE: 'close-pending' },
    },
  );
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr + result.stdout).toBe(1);
  expect(result.stderr).toContain('server child closed before becoming healthy');
  expect(result.stderr).not.toContain('timed out');
  const line = result.stdout.split('\n').find((item) => item.startsWith('INERT_CHILD_RECEIPT:'));
  expect(line, result.stderr + result.stdout).toBeDefined();
  expect(JSON.parse(line!.slice('INERT_CHILD_RECEIPT:'.length))).toMatchObject({
    closed: true,
    signals: [],
    fetchAborted: true,
  });
  expect(result.stdout).not.toContain('server-tsx-boot-smoke: OK');
});

it('disposes child and stream observers after confirmed cleanup while preserving borrowed observers', () => {
  const result = spawnSync(
    process.execPath,
    ['--import', resolve(here, 'fixtures/smoke-inert-child.mjs'), script],
    {
      encoding: 'utf8',
      timeout: 5000,
      env: { ...process.env, NODE_ENV: 'test', SMOKE_TEST_CASE: 'dispose-listeners' },
    },
  );
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr + result.stdout).toBe(0);
  const line = result.stdout.split('\n').find((item) => item.startsWith('INERT_CHILD_RECEIPT:'));
  expect(line, result.stderr + result.stdout).toBeDefined();
  expect(JSON.parse(line!.slice('INERT_CHILD_RECEIPT:'.length))).toMatchObject({
    closed: true,
    signals: ['SIGTERM'],
    remainingOwnedListeners: [],
    borrowedListenersPreserved: true,
  });
  expect(result.stdout).toContain('server-tsx-boot-smoke: OK');
});

it('clears outstanding request timers after completed health and confirmed cleanup', () => {
  const result = spawnSync(
    process.execPath,
    ['--import', resolve(here, 'fixtures/smoke-inert-child.mjs'), script],
    {
      encoding: 'utf8',
      timeout: 5000,
      env: { ...process.env, NODE_ENV: 'test', SMOKE_TEST_CASE: 'dispose-timers' },
    },
  );
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr + result.stdout).toBe(0);
  const line = result.stdout.split('\n').find((item) => item.startsWith('INERT_CHILD_RECEIPT:'));
  expect(line, result.stderr + result.stdout).toBeDefined();
  expect(JSON.parse(line!.slice('INERT_CHILD_RECEIPT:'.length))).toMatchObject({
    closed: true,
    signals: ['SIGTERM'],
    remainingOwnedListeners: [],
    borrowedListenersPreserved: true,
    activeTimerDurations: [],
    remainingProcessSignals: [],
  });
});
