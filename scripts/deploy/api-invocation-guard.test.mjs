import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  classifyInvocationResponse,
  probeInvocation,
} from './api-invocation-guard.mjs';

const APP_BODY = JSON.stringify({
  success: false,
  error: 'Authentication required',
  code: 'HTTP_401',
  requestId: 'req_smoke',
});

test('app 401 JSON passes', () => {
  const result = classifyInvocationResponse({
    status: 401,
    headers: { 'content-type': 'application/json; charset=UTF-8' },
    body: APP_BODY,
  });
  assert.equal(result.pass, true);
});

test('Vercel SSO 401 HTML fails', () => {
  const result = classifyInvocationResponse({
    status: 401,
    headers: { 'content-type': 'text/html; charset=utf-8' },
    body: '<!DOCTYPE html><html><body>Authentication Required</body></html>',
  });
  assert.equal(result.pass, false);
});

test('302 to vercel.com fails', () => {
  const result = classifyInvocationResponse({
    status: 302,
    headers: {
      location: 'https://vercel.com/sso?url=https%3A%2F%2Fexample.vercel.app%2F',
      'content-type': 'text/plain',
    },
    body: '',
  });
  assert.equal(result.pass, false);
  assert.equal(result.reason, 'vercel-redirect');
});

test('5xx fails', () => {
  const result = classifyInvocationResponse({
    status: 503,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ error: 'FUNCTION_INVOCATION_FAILED' }),
  });
  assert.equal(result.pass, false);
});

test('timeout fails', async () => {
  const result = await probeInvocation('https://api.revealui.com/api/billing/subscription', {
    timeoutMs: 30,
    fetchImpl: (_url, init) =>
      new Promise((_resolve, reject) => {
        const signal = init?.signal;
        if (!signal) {
          reject(new Error('missing abort signal'));
          return;
        }
        signal.addEventListener('abort', () => {
          const error = new Error('The operation was aborted');
          error.name = 'AbortError';
          reject(error);
        });
      }),
  });
  assert.equal(result.pass, false);
  assert.equal(result.reason, 'timeout');
});

test('app JSON with a protection header fails', () => {
  const headerResult = classifyInvocationResponse({
    status: 401,
    headers: {
      'content-type': 'application/json',
      'x-vercel-mitigated': 'deny',
    },
    body: APP_BODY,
  });
  assert.equal(headerResult.pass, false);
  assert.equal(headerResult.reason, 'protection-header');

  const cookieResult = classifyInvocationResponse({
    status: 401,
    headers: {
      'content-type': 'application/json',
      'set-cookie': '_vercel_sso_nonce=abc; Path=/; HttpOnly',
    },
    body: APP_BODY,
  });
  assert.equal(cookieResult.pass, false);
  assert.equal(cookieResult.reason, 'protection-header');
});

test('probeInvocation accepts the app 401 from fetch', async () => {
  const result = await probeInvocation('https://api.revealui.com/api/billing/subscription', {
    fetchImpl: async () => ({
      status: 401,
      headers: { 'content-type': 'application/json; charset=UTF-8' },
      text: async () => APP_BODY,
    }),
  });
  assert.equal(result.pass, true);
  assert.equal(result.reason, 'app-401');
});
