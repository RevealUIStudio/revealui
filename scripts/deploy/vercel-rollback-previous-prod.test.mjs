import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  aliasesToMove,
  DEFAULT_ADMIN_ROLLBACK_FLOOR_CREATED_AT_MS,
  DEFAULT_ADMIN_ROLLBACK_FLOOR_DEPLOYMENT_ID,
  PRODUCTION_ALIASES,
  rollbackRefusalMessage,
  selectRollbackTarget,
} from './vercel-rollback-previous-prod.mjs';

const FLOOR_MS = DEFAULT_ADMIN_ROLLBACK_FLOOR_CREATED_AT_MS;

function deployment(uid, createdAt) {
  return { uid, createdAt };
}

test('api rollback moves only production hostnames', () => {
  const moved = aliasesToMove('api', [
    { alias: 'api.revealui.com' },
    { alias: 'revealui-api.vercel.app' },
    { alias: 'test.api.revealui.com' },
    { alias: 'api-test.revealui.com' },
  ]);
  assert.deepEqual(
    moved.map((a) => a.alias),
    ['api.revealui.com', 'revealui-api.vercel.app'],
  );
});

test('unknown app refuses an implicit move-everything list', () => {
  assert.equal(aliasesToMove('preview', [{ alias: 'api.revealui.com' }]), null);
  const apiHosts = new Set(PRODUCTION_ALIASES.api);
  assert.equal(apiHosts.has('test.api.revealui.com'), false);
});

test('candidate before the floor is skipped', () => {
  const before = deployment('dpl_before', FLOOR_MS - 1);
  const atFloor = deployment('dpl_at_floor', FLOOR_MS);
  const decision = selectRollbackTarget(
    [deployment('dpl_current', FLOOR_MS + 60_000), before, atFloor],
    { appLabel: 'admin' },
  );
  assert.equal(decision.rollback, true);
  assert.equal(decision.target.uid, 'dpl_at_floor');
  assert.notEqual(decision.target.uid, before.uid);
});

test('candidate at or after the floor is picked', () => {
  const atFloor = selectRollbackTarget(
    [deployment('dpl_current', FLOOR_MS + 60_000), deployment('dpl_at_floor', FLOOR_MS)],
    { appLabel: 'admin' },
  );
  assert.equal(atFloor.rollback, true);
  assert.equal(atFloor.target.uid, 'dpl_at_floor');

  const afterFloor = selectRollbackTarget(
    [
      deployment('dpl_current', FLOOR_MS + 120_000),
      { uid: 'dpl_after_floor', created: FLOOR_MS + 1 },
    ],
    { appLabel: 'admin' },
  );
  assert.equal(afterFloor.rollback, true);
  assert.equal(afterFloor.target.uid, 'dpl_after_floor');

  const floorRecord = selectRollbackTarget(
    [
      deployment('dpl_current', FLOOR_MS + 120_000),
      deployment(DEFAULT_ADMIN_ROLLBACK_FLOOR_DEPLOYMENT_ID, FLOOR_MS),
    ],
    { appLabel: 'admin' },
  );
  assert.equal(floorRecord.target.uid, DEFAULT_ADMIN_ROLLBACK_FLOOR_DEPLOYMENT_ID);
});

test('no eligible candidate leads to no rollback', () => {
  const decision = selectRollbackTarget(
    [deployment('dpl_current', FLOOR_MS + 60_000), deployment('dpl_before', FLOOR_MS - 1)],
    { appLabel: 'admin' },
  );
  assert.equal(decision.rollback, false);
  assert.equal(decision.target, null);
  assert.equal(decision.reason, 'below-floor');
  const message = rollbackRefusalMessage(decision, {
    appLabel: 'admin',
    floorDeploymentId: DEFAULT_ADMIN_ROLLBACK_FLOOR_DEPLOYMENT_ID,
    foundCount: 2,
  });
  assert.equal(message.includes('No rollback was performed'), true);
});

test('explicit target wins', () => {
  const automatic = deployment('dpl_automatic', FLOOR_MS + 5_000);
  const chosen = deployment('dpl_chosen', FLOOR_MS - 5_000);
  const decision = selectRollbackTarget(
    [deployment('dpl_current', FLOOR_MS + 60_000), automatic, chosen],
    { appLabel: 'admin', explicitTargetId: 'dpl_chosen' },
  );
  assert.equal(decision.rollback, true);
  assert.equal(decision.reason, 'explicit-target');
  assert.equal(decision.target.uid, 'dpl_chosen');
});

test('an overridden admin floor skips candidates created before that deployment', () => {
  const customFloor = deployment('dpl_custom_floor', FLOOR_MS + 30_000);
  const between = deployment('dpl_between', FLOOR_MS + 1_000);
  const decision = selectRollbackTarget(
    [deployment('dpl_current', FLOOR_MS + 90_000), between, customFloor],
    { appLabel: 'admin', floorDeploymentId: 'dpl_custom_floor' },
  );
  assert.equal(decision.target.uid, 'dpl_custom_floor');
});

test('other projects keep the immediate previous deployment', () => {
  const previous = deployment('dpl_previous', FLOOR_MS - 10_000);
  const decision = selectRollbackTarget(
    [deployment('dpl_current', FLOOR_MS + 10_000), previous, deployment('dpl_older', FLOOR_MS - 20_000)],
    { appLabel: 'api' },
  );
  assert.equal(decision.rollback, true);
  assert.equal(decision.reason, 'previous');
  assert.equal(decision.target.uid, 'dpl_previous');
});

test('admin and marketing keep their production names', () => {
  assert.deepEqual(
    aliasesToMove('admin', [{ alias: 'admin.revealui.com' }, { alias: 'other.example' }]).map(
      (a) => a.alias,
    ),
    ['admin.revealui.com'],
  );
  assert.deepEqual(
    aliasesToMove('marketing', [
      { alias: 'www.revealui.com' },
      { alias: 'revealui.com' },
      { alias: 'test.api.revealui.com' },
    ]).map((a) => a.alias),
    ['www.revealui.com', 'revealui.com'],
  );
});
