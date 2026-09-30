import assert from 'node:assert/strict';
import { test } from 'node:test';
import { auditStandaloneProductionDependencies } from './apify-standalone-dependency-audit.mjs';

test('standalone production audit runs against the generated artifact and fails closed', () => {
  const failure = new Error('npm audit found a production advisory');
  let invocation;

  assert.throws(
    () =>
      auditStandaloneProductionDependencies('/tmp/apify-standalone-fixture', (...args) => {
        invocation = args;
        throw failure;
      }),
    (error) => error === failure,
  );

  assert.deepEqual(invocation, [
    'npm',
    ['audit', '--omit=dev', '--audit-level=low'],
    { cwd: '/tmp/apify-standalone-fixture', stdio: 'inherit' },
  ]);
});
