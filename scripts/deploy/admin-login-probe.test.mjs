import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyAdminLoginProbe, probeAdminLogin } from './admin-login-probe.mjs';

const LOGIN_HTML =
  '<!DOCTYPE html><html><body><h2>Sign in</h2><input id="email" type="email" /></body></html>';

const SSO_API = 'https://vercel.com/sso-api?url=https%3A%2F%2Fadmin.revealui.com%2Flogin';

test('admin login 200 with the sign-in marker passes', () => {
  const result = classifyAdminLoginProbe({
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
    body: LOGIN_HTML,
  });
  assert.equal(result.pass, true);
  assert.equal(result.reason, 'admin-login');
});

test('302 to vercel.com/sso-api fails the admin probe even when the body contains the sign-in marker', () => {
  const result = classifyAdminLoginProbe({
    status: 302,
    headers: { location: SSO_API, 'content-type': 'text/html' },
    body: LOGIN_HTML,
  });
  assert.equal(result.pass, false);
  assert.equal(result.reason, 'vercel-redirect');
});

test('any 3xx fails the admin probe', () => {
  const result = classifyAdminLoginProbe({
    status: 307,
    headers: { location: 'https://example.com/login', 'content-type': 'text/html' },
    body: LOGIN_HTML,
  });
  assert.equal(result.pass, false);
  assert.equal(result.reason, 'redirect');
});

test('authentication page body fails the admin probe', () => {
  const result = classifyAdminLoginProbe({
    status: 200,
    headers: { 'content-type': 'text/html' },
    body: `${LOGIN_HTML}<p>Protected by Vercel Authentication</p>`,
  });
  assert.equal(result.pass, false);
  assert.equal(result.reason, 'protection-body');
});

test('admin probe does not follow a 302 to vercel.com/sso-api', async () => {
  let redirectMode;
  const result = await probeAdminLogin('https://admin.revealui.com/login', {
    timeoutMs: 1000,
    fetchImpl: async (_url, init) => {
      redirectMode = init?.redirect;
      return {
        status: 302,
        headers: { location: SSO_API, 'content-type': 'text/html' },
        text: async () => 'Protected by Vercel Authentication',
      };
    },
  });
  assert.equal(redirectMode, 'manual');
  assert.equal(result.pass, false);
});
