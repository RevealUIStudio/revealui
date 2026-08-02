#!/usr/bin/env node
/**
 * Phase 2.2.5 HTTP smoke for dual-mode rsc-poc (preview or dev).
 * Usage: BASE_URL=http://127.0.0.1:4173 node scripts/smoke-http.mjs
 */
const base = (process.env.BASE_URL ?? 'http://127.0.0.1:4173').replace(/\/$/, '');

async function check(path, { accept, expectStatus = 200, bodyIncludes = [] } = {}) {
  const headers = {};
  if (accept) headers.accept = accept;
  const res = await fetch(`${base}${path}`, { headers });
  const text = await res.text();
  if (res.status !== expectStatus) {
    throw new Error(`${path}: status ${res.status} (want ${expectStatus})`);
  }
  for (const s of bodyIncludes) {
    if (!text.includes(s)) {
      throw new Error(`${path}: missing ${JSON.stringify(s)}`);
    }
  }
  return { status: res.status, contentType: res.headers.get('content-type') ?? '', len: text.length };
}

const results = [];
results.push(
  await check('/', {
    bodyIncludes: ['Home', '__RSC_PAYLOAD__'],
  }),
);
results.push(
  await check('/', {
    accept: 'text/x-component',
    bodyIncludes: [],
  }),
);
if (!results[1].contentType.includes('text/x-component')) {
  throw new Error(`RSC accept content-type: ${results[1].contentType}`);
}
results.push(await check('/counter', { bodyIncludes: ['Counter'] }));
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
  }),
);

console.log(JSON.stringify({ ok: true, base, results }, null, 2));
