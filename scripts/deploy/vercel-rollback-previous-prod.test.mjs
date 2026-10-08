import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  aliasesToMove,
  floorFromLookup,
  PRODUCTION_ALIASES,
  rollbackRefusalMessage,
  selectRollbackTarget,
} from './vercel-rollback-previous-prod.mjs';

const FLOOR_ID = 'dpl_floor';
const FLOOR_CREATED_AT = 2_000;

function deployment(uid, createdAt) {
  return { uid, createdAt };
}

function liveBuildLeftInPlace(message) {
  assert.equal(message.includes('The live build was left in place.'), true);
  assert.equal(message.includes('No rollback was performed.'), true);
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

test('admin floor unset refuses rollback', () => {
  const decision = selectRollbackTarget(
    [deployment('dpl_current', 5_000), deployment('dpl_previous', 4_000)],
    { appLabel: 'admin', floorDeploymentId: '   ', floorCreatedAt: FLOOR_CREATED_AT },
  );
  assert.equal(decision.rollback, false);
  assert.equal(decision.target, null);
  assert.equal(decision.reason, 'floor-unset');
  const blankLookup = floorFromLookup('  ', { createdAt: FLOOR_CREATED_AT });
  assert.equal(blankLookup.reason, 'floor-unset');
  assert.equal(blankLookup.ok, false);
  liveBuildLeftInPlace(
    rollbackRefusalMessage(decision, { appLabel: 'admin', floorDeploymentId: '' }),
  );
});

test('admin floor that cannot be resolved refuses rollback', () => {
  const missing = floorFromLookup(FLOOR_ID, null);
  assert.equal(missing.ok, false);
  assert.equal(missing.reason, 'floor-unresolvable');
  assert.equal(missing.floorCreatedAt, null);

  const withoutCreatedAt = floorFromLookup(FLOOR_ID, { id: FLOOR_ID });
  assert.equal(withoutCreatedAt.reason, 'floor-unresolvable');

  const decision = selectRollbackTarget(
    [deployment('dpl_current', 5_000), deployment('dpl_previous', 4_000)],
    {
      appLabel: 'admin',
      floorDeploymentId: missing.floorDeploymentId,
      floorCreatedAt: missing.floorCreatedAt,
    },
  );
  assert.equal(decision.rollback, false);
  assert.equal(decision.target, null);
  assert.equal(decision.reason, 'floor-unresolvable');
  liveBuildLeftInPlace(
    rollbackRefusalMessage(decision, { appLabel: 'admin', floorDeploymentId: FLOOR_ID }),
  );
});

test('a rollback target created before the floor is skipped', () => {
  const resolved = floorFromLookup(FLOOR_ID, { id: FLOOR_ID, createdAt: FLOOR_CREATED_AT });
  assert.equal(resolved.ok, true);
  assert.equal(resolved.floorCreatedAt, FLOOR_CREATED_AT);

  const before = deployment('dpl_before', FLOOR_CREATED_AT - 1);
  const after = deployment('dpl_after', FLOOR_CREATED_AT + 1);
  const decision = selectRollbackTarget(
    [deployment('dpl_current', FLOOR_CREATED_AT + 50), before, after],
    {
      appLabel: 'admin',
      floorDeploymentId: resolved.floorDeploymentId,
      floorCreatedAt: resolved.floorCreatedAt,
    },
  );
  assert.equal(decision.rollback, true);
  assert.equal(decision.reason, 'at-or-after-floor');
  assert.equal(decision.target.uid, after.uid);
  assert.notEqual(decision.target.uid, before.uid);
});

test('the floor deployment itself stays eligible', () => {
  const byTimestamp = selectRollbackTarget(
    [
      deployment('dpl_current', FLOOR_CREATED_AT + 50),
      deployment('dpl_before', FLOOR_CREATED_AT - 1),
      deployment(FLOOR_ID, FLOOR_CREATED_AT),
    ],
    { appLabel: 'admin', floorDeploymentId: FLOOR_ID, floorCreatedAt: FLOOR_CREATED_AT },
  );
  assert.equal(byTimestamp.rollback, true);
  assert.equal(byTimestamp.target.uid, FLOOR_ID);

  const byIdWithoutTimestamp = selectRollbackTarget(
    [deployment('dpl_current', FLOOR_CREATED_AT + 50), { uid: FLOOR_ID }],
    { appLabel: 'admin', floorDeploymentId: FLOOR_ID, floorCreatedAt: FLOOR_CREATED_AT },
  );
  assert.equal(byIdWithoutTimestamp.rollback, true);
  assert.equal(byIdWithoutTimestamp.target.uid, FLOOR_ID);
});

test('no eligible admin target leaves the live build in place', () => {
  const decision = selectRollbackTarget(
    [
      deployment('dpl_current', FLOOR_CREATED_AT + 50),
      deployment('dpl_before', FLOOR_CREATED_AT - 1),
    ],
    { appLabel: 'admin', floorDeploymentId: FLOOR_ID, floorCreatedAt: FLOOR_CREATED_AT },
  );
  assert.equal(decision.rollback, false);
  assert.equal(decision.target, null);
  assert.equal(decision.reason, 'no-eligible-target');
  const message = rollbackRefusalMessage(decision, {
    appLabel: 'admin',
    floorDeploymentId: FLOOR_ID,
    foundCount: 2,
  });
  liveBuildLeftInPlace(message);
  assert.equal(message.includes(FLOOR_ID), true);
});

test('other apps still restore the immediate previous deployment', () => {
  const previous = deployment('dpl_previous', FLOOR_CREATED_AT - 10);
  const decision = selectRollbackTarget(
    [deployment('dpl_current', FLOOR_CREATED_AT + 10), previous],
    { appLabel: 'api', floorDeploymentId: '', floorCreatedAt: null },
  );
  assert.equal(decision.rollback, true);
  assert.equal(decision.reason, 'previous');
  assert.equal(decision.target.uid, previous.uid);
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
