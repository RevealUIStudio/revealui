#!/usr/bin/env node
/**
 * Phase 2.2.5 + 2.3.4 HTTP smoke for dual-mode rsc-poc (preview or dev).
 * Usage: BASE_URL=http://127.0.0.1:4173 node scripts/smoke-http.mjs
 */
const base = (process.env.BASE_URL ?? 'http://127.0.0.1:4173').replace(/\/$/, '');

async function check(
  path,
  { accept, expectStatus = 200, bodyIncludes = [], expectHeaders = {}, method = 'GET', extraHeaders = {} } = {},
) {
  const headers = { ...extraHeaders };
  if (accept) headers.accept = accept;
  const res = await fetch(`${base}${path}`, { method, headers });
  const text = await res.text();
  if (res.status !== expectStatus) {
    throw new Error(`${path}: status ${res.status} (want ${expectStatus})`);
  }
  for (const s of bodyIncludes) {
    if (!text.includes(s)) {
      throw new Error(`${path}: missing ${JSON.stringify(s)}`);
    }
  }
  for (const [name, want] of Object.entries(expectHeaders)) {
    const got = res.headers.get(name);
    if (want === true) {
      if (!got) throw new Error(`${path}: missing header ${name}`);
    } else if (got !== want) {
      throw new Error(`${path}: header ${name}=${JSON.stringify(got)} (want ${JSON.stringify(want)})`);
    }
  }
  return {
    status: res.status,
    contentType: res.headers.get('content-type') ?? '',
    len: text.length,
    xcto: res.headers.get('x-content-type-options'),
    xfo: res.headers.get('x-frame-options'),
  };
}

const securityHeaders = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'content-security-policy': true,
  'referrer-policy': 'strict-origin-when-cross-origin',
};

const results = [];
results.push(
  await check('/', {
    bodyIncludes: ['Home', '__RSC_PAYLOAD__'],
    expectHeaders: securityHeaders,
  }),
);
results.push(
  await check('/', {
    accept: 'text/x-component',
    bodyIncludes: [],
    expectHeaders: securityHeaders,
  }),
);
if (!results[1].contentType.includes('text/x-component')) {
  throw new Error(`RSC accept content-type: ${results[1].contentType}`);
}
results.push(await check('/counter', { bodyIncludes: ['Counter'], expectHeaders: securityHeaders }));
results.push(await check('/actions', { bodyIncludes: ['Actions'] }));
results.push(await check('/nope', { expectStatus: 404, bodyIncludes: ['Not Found', '404'] }));
results.push(
  await check('/errors/not-found', {
    expectStatus: 404,
    bodyIncludes: ['Not Found', 'data-router-not-found'],
  }),
);
results.push(
  await check('/errors/boom', {
    expectStatus: 500,
    bodyIncludes: ['data-router-error', 'Go Home'],
    expectHeaders: securityHeaders,
  }),
);

// 2.3.4 CSRF origin gate on progressive form POST
results.push(
  await check('/api/session/login', {
    method: 'POST',
    expectStatus: 403,
    bodyIncludes: ['Origin mismatch'],
    extraHeaders: { origin: 'https://evil.example' },
  }),
);

console.log(JSON.stringify({ ok: true, base, results }, null, 2));
