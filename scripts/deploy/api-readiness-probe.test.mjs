import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyApiReadinessProbe, probeApiReadiness } from './api-readiness-probe.mjs';

const READY_BODY = JSON.stringify({
  status: 'healthy',
  timestamp: '2026-10-09T00:00:00.000Z',
  uptime: 12,
  checks: { database: { status: 'healthy' } },
});

const SSO_API = 'https://vercel.com/sso-api?url=https%3A%2F%2Fapi.revealui.com%2Fhealth%2Fready';

test('api readiness 200 JSON health shape passes', () => {
  const result = classifyApiReadinessProbe({
    status: 200,
    headers: { 'content-type': 'application/json; charset=UTF-8' },
    body: READY_BODY,
  });
  assert.equal(result.pass, true);
  assert.equal(result.reason, 'api-ready');
});

test('302 to vercel.com/sso-api fails readiness even when the body is non-empty health JSON', () => {
  const result = classifyApiReadinessProbe({
    status: 302,
    headers: { location: SSO_API, 'content-type': 'application/json' },
    body: READY_BODY,
  });
  assert.equal(result.pass, false);
  assert.equal(result.reason, 'vercel-redirect');
});

test('any 3xx fails the readiness probe', () => {
  const result = classifyApiReadinessProbe({
    status: 302,
    headers: { 'content-type': 'text/html' },
    body: '<html>not empty</html>',
  });
  assert.equal(result.pass, false);
  assert.equal(result.reason, 'redirect');
});

test('authentication page body fails the readiness probe', () => {
  const result = classifyApiReadinessProbe({
    status: 200,
    headers: { 'content-type': 'text/html' },
    body: '<html>Protected by Vercel Authentication</html>',
  });
  assert.equal(result.pass, false);
  assert.equal(result.reason, 'protection-body');
});

test('a non-empty body without the health shape fails', () => {
  const result = classifyApiReadinessProbe({
    status: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'ok' }),
  });
  assert.equal(result.pass, false);
  assert.equal(result.reason, 'unexpected-body');
});

test('readiness probe does not follow a 302 to vercel.com/sso-api', async () => {
  let redirectMode;
  const result = await probeApiReadiness('https://api.revealui.com/health/ready', {
    timeoutMs: 1000,
    fetchImpl: async (_url, init) => {
      redirectMode = init?.redirect;
      return {
        status: 302,
        headers: { location: SSO_API },
        text: async () => 'not empty',
      };
    },
  });
  assert.equal(redirectMode, 'manual');
  assert.equal(result.pass, false);
});
