import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  aliasesToMove,
  fetchWithTimeout,
  floorFromLookup,
  PRODUCTION_ALIASES,
  ROLLBACK_FLOOR_ENV,
  rollbackFloorEnvName,
  rollbackRefusalMessage,
  selectRollbackTarget,
  VERCEL_API_TIMEOUT_MS,
} from './vercel-rollback-previous-prod.mjs';

const FLOOR_ID = 'dpl_floor';
const FLOOR_CREATED_AT = 2_000;
const PROJECT_ID = 'prj_expected';
const FLOORED_APPS = ['api', 'admin'];

function deployment(uid, createdAt) {
  return { uid, createdAt };
}

function readyFloor(overrides = {}) {
  return {
    id: FLOOR_ID,
    projectId: PROJECT_ID,
    target: 'production',
    readyState: 'READY',
    createdAt: FLOOR_CREATED_AT,
    ...overrides,
  };
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

test('api project selection uses the rollback floor', () => {
  assert.equal(ROLLBACK_FLOOR_ENV.api, 'API_ROLLBACK_FLOOR_DEPLOYMENT_ID');
  assert.equal(rollbackFloorEnvName('api'), 'API_ROLLBACK_FLOOR_DEPLOYMENT_ID');
  assert.equal(rollbackFloorEnvName('admin'), 'ADMIN_ROLLBACK_FLOOR_DEPLOYMENT_ID');

  const resolved = floorFromLookup(FLOOR_ID, readyFloor(), { projectId: PROJECT_ID });
  assert.equal(resolved.ok, true);
  assert.equal(resolved.floorCreatedAt, FLOOR_CREATED_AT);

  // Ids are ordered opposite to createdAt so a string compare would pick the
  // older deployment. Selection follows createdAt and skips the live build.
  const older = deployment('dpl_z_older', FLOOR_CREATED_AT + 10);
  const newestEligible = deployment('dpl_a_newer', FLOOR_CREATED_AT + 40);
  const decision = selectRollbackTarget(
    [
      deployment('dpl_current', FLOOR_CREATED_AT + 80),
      older,
      deployment('dpl_m_before', FLOOR_CREATED_AT - 1),
      newestEligible,
    ],
    {
      appLabel: 'api',
      floorDeploymentId: resolved.floorDeploymentId,
      floorCreatedAt: resolved.floorCreatedAt,
    },
  );
  assert.equal(decision.rollback, true);
  assert.equal(decision.reason, 'at-or-after-floor');
  assert.equal(decision.target.uid, newestEligible.uid);
  assert.notEqual(decision.target.uid, older.uid);
});

test('floor unset refuses rollback', () => {
  for (const appLabel of FLOORED_APPS) {
    const decision = selectRollbackTarget(
      [deployment('dpl_current', 5_000), deployment('dpl_previous', 4_000)],
      { appLabel, floorDeploymentId: '   ', floorCreatedAt: FLOOR_CREATED_AT },
    );
    assert.equal(decision.rollback, false);
    assert.equal(decision.target, null);
    assert.equal(decision.reason, 'floor-unset');
    const blankLookup = floorFromLookup('  ', readyFloor(), { projectId: PROJECT_ID });
    assert.equal(blankLookup.reason, 'floor-unset');
    assert.equal(blankLookup.ok, false);
    const message = rollbackRefusalMessage(decision, { appLabel, floorDeploymentId: '' });
    liveBuildLeftInPlace(message);
    assert.equal(message.includes(`${ROLLBACK_FLOOR_ENV[appLabel]} is unset.`), true);
  }
});

test('floor that cannot be resolved refuses rollback', () => {
  for (const appLabel of FLOORED_APPS) {
    const missing = floorFromLookup(FLOOR_ID, null, { projectId: PROJECT_ID });
    assert.equal(missing.ok, false);
    assert.equal(missing.reason, 'floor-unresolvable');
    assert.equal(missing.floorCreatedAt, null);

    const withoutCreatedAt = floorFromLookup(
      FLOOR_ID,
      { id: FLOOR_ID, projectId: PROJECT_ID, target: 'production', readyState: 'READY' },
      { projectId: PROJECT_ID },
    );
    assert.equal(withoutCreatedAt.reason, 'floor-unresolvable');

    const decision = selectRollbackTarget(
      [deployment('dpl_current', 5_000), deployment('dpl_previous', 4_000)],
      {
        appLabel,
        floorDeploymentId: missing.floorDeploymentId,
        floorCreatedAt: missing.floorCreatedAt,
      },
    );
    assert.equal(decision.rollback, false);
    assert.equal(decision.target, null);
    assert.equal(decision.reason, 'floor-unresolvable');
    liveBuildLeftInPlace(
      rollbackRefusalMessage(decision, { appLabel, floorDeploymentId: FLOOR_ID }),
    );
  }
});

test('a floor from another project fails closed', () => {
  for (const appLabel of FLOORED_APPS) {
    const lookup = floorFromLookup(
      FLOOR_ID,
      readyFloor({ projectId: 'prj_other' }),
      { projectId: PROJECT_ID },
    );
    assert.equal(lookup.ok, false);
    assert.equal(lookup.reason, 'floor-wrong-project');
    assert.equal(lookup.floorCreatedAt, null);
    const message = rollbackRefusalMessage(lookup, {
      appLabel,
      floorDeploymentId: FLOOR_ID,
      projectId: PROJECT_ID,
    });
    liveBuildLeftInPlace(message);
    assert.equal(message.includes('prj_other'), true);
    assert.equal(message.includes(PROJECT_ID), true);
    assert.equal(message.includes(FLOOR_ID), true);
  }
});

test('a floor that is not READY fails closed', () => {
  for (const appLabel of FLOORED_APPS) {
    for (const body of [
      readyFloor({ readyState: 'ERROR' }),
      readyFloor({ readyState: 'BUILDING', state: 'BUILDING' }),
      readyFloor({ readyState: undefined, state: 'CANCELED' }),
      readyFloor({ readyState: undefined, state: undefined }),
    ]) {
      const lookup = floorFromLookup(FLOOR_ID, body, { projectId: PROJECT_ID });
      assert.equal(lookup.ok, false);
      assert.equal(lookup.reason, 'floor-not-ready');
      const message = rollbackRefusalMessage(lookup, { appLabel, floorDeploymentId: FLOOR_ID });
      liveBuildLeftInPlace(message);
      assert.equal(message.includes('is not READY.'), true);
    }
  }
});

test('a floor that is not production fails closed', () => {
  for (const appLabel of FLOORED_APPS) {
    for (const target of ['preview', 'staging', '', undefined]) {
      const lookup = floorFromLookup(FLOOR_ID, readyFloor({ target }), { projectId: PROJECT_ID });
      assert.equal(lookup.ok, false);
      assert.equal(lookup.reason, 'floor-not-production');
      const message = rollbackRefusalMessage(lookup, { appLabel, floorDeploymentId: FLOOR_ID });
      liveBuildLeftInPlace(message);
      assert.equal(message.includes('does not target production.'), true);
    }
  }
});

test('a rollback target older than the floor is skipped by createdAt', () => {
  for (const appLabel of FLOORED_APPS) {
    const resolved = floorFromLookup(FLOOR_ID, readyFloor(), { projectId: PROJECT_ID });
    assert.equal(resolved.ok, true);

    // dpl_z sorts after the floor id. Its createdAt is still older, so it is skipped.
    const before = deployment('dpl_z_before', FLOOR_CREATED_AT - 1);
    const after = deployment('dpl_a_after', FLOOR_CREATED_AT + 1);
    const decision = selectRollbackTarget(
      [deployment('dpl_current', FLOOR_CREATED_AT + 50), before, after],
      {
        appLabel,
        floorDeploymentId: resolved.floorDeploymentId,
        floorCreatedAt: resolved.floorCreatedAt,
      },
    );
    assert.equal(decision.rollback, true);
    assert.equal(decision.reason, 'at-or-after-floor');
    assert.equal(decision.target.uid, after.uid);
    assert.notEqual(decision.target.uid, before.uid);
  }
});

test('the floor deployment itself stays eligible', () => {
  for (const appLabel of FLOORED_APPS) {
    const byTimestamp = selectRollbackTarget(
      [
        deployment('dpl_current', FLOOR_CREATED_AT + 50),
        deployment('dpl_z_before', FLOOR_CREATED_AT - 1),
        deployment(FLOOR_ID, FLOOR_CREATED_AT),
      ],
      { appLabel, floorDeploymentId: FLOOR_ID, floorCreatedAt: FLOOR_CREATED_AT },
    );
    assert.equal(byTimestamp.rollback, true);
    assert.equal(byTimestamp.target.uid, FLOOR_ID);

    const idOnly = selectRollbackTarget(
      [deployment('dpl_current', FLOOR_CREATED_AT + 50), { uid: FLOOR_ID }],
      { appLabel, floorDeploymentId: FLOOR_ID, floorCreatedAt: FLOOR_CREATED_AT },
    );
    assert.equal(idOnly.rollback, false);
    assert.equal(idOnly.reason, 'no-eligible-target');
    assert.equal(idOnly.target, null);
  }
});

test('a live floor with nothing older eligible keeps the live build and fails', () => {
  for (const appLabel of FLOORED_APPS) {
    const decision = selectRollbackTarget(
      [deployment(FLOOR_ID, FLOOR_CREATED_AT), deployment('dpl_z_before', FLOOR_CREATED_AT - 1)],
      { appLabel, floorDeploymentId: FLOOR_ID, floorCreatedAt: FLOOR_CREATED_AT },
    );
    assert.equal(decision.rollback, false);
    assert.equal(decision.target, null);
    assert.equal(decision.reason, 'no-eligible-target');
    const message = rollbackRefusalMessage(decision, {
      appLabel,
      floorDeploymentId: FLOOR_ID,
      foundCount: 2,
    });
    liveBuildLeftInPlace(message);
    assert.equal(message.includes(FLOOR_ID), true);
  }
});

test('no eligible target leaves the live build in place', () => {
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

test('vercel api fetch aborts when the request outlasts the timeout', async () => {
  assert.equal(VERCEL_API_TIMEOUT_MS, 10_000);
  await assert.rejects(
    fetchWithTimeout(
      'https://api.vercel.com/v13/deployments/dpl_floor',
      { headers: { Authorization: 'Bearer test' } },
      30,
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => {
            const error = new Error('The operation was aborted');
            error.name = 'AbortError';
            reject(error);
          });
        }),
    ),
    (error) => {
      assert.equal(error instanceof Error, true);
      assert.equal(error.message.includes('timed out after 30ms'), true);
      return true;
    },
  );
});

test('vercel api fetch returns when the request finishes before the timeout', async () => {
  const response = await fetchWithTimeout(
    'https://api.vercel.com/v13/deployments/dpl_floor',
    {},
    200,
    async () => ({ ok: true, status: 200 }),
  );
  assert.equal(response.ok, true);
  assert.equal(response.status, 200);
});

test('apps without a floor variable still restore the immediate previous deployment', () => {
  const previous = deployment('dpl_previous', FLOOR_CREATED_AT - 10);
  const decision = selectRollbackTarget(
    [deployment('dpl_current', FLOOR_CREATED_AT + 10), previous],
    { appLabel: 'marketing', floorDeploymentId: FLOOR_ID, floorCreatedAt: FLOOR_CREATED_AT },
  );
  assert.equal(rollbackFloorEnvName('marketing'), '');
  assert.equal(rollbackFloorEnvName('docs'), '');
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

test('a ready production floor on the expected project resolves', () => {
  const byState = floorFromLookup(
    FLOOR_ID,
    readyFloor({ readyState: undefined, state: 'READY' }),
    { projectId: PROJECT_ID },
  );
  assert.equal(byState.ok, true);
  assert.equal(byState.reason, 'resolved');

  const wrapped = floorFromLookup(
    FLOOR_ID,
    { deployment: readyFloor() },
    { projectId: PROJECT_ID },
  );
  assert.equal(wrapped.ok, true);
  assert.equal(wrapped.floorCreatedAt, FLOOR_CREATED_AT);
});
