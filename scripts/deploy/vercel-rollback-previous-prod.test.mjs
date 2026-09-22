import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aliasesToMove, PRODUCTION_ALIASES } from './vercel-rollback-previous-prod.mjs';

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
