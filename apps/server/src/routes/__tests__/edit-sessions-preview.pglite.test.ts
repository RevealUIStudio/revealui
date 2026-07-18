/**
 * Preview-token endpoints  -  integration tests against a REAL migrated schema
 * (PGlite) and the real Hono session routes.
 *
 * Covers the P1 slice-4 security posture:
 *   - mint: returns a token + previewUrl carrying rvui-edit / rvui-session,
 *     landing on the resolved page path (or site root)
 *   - mint: auth (anon 401 / non-editor 403) + non-open session 409
 *   - GET /preview: valid token returns docs + adminOrigin, no cookie needed
 *   - GET /preview: bad / expired / wrong-session tokens rejected, docs NEVER leaked
 *   - GET /preview: non-open session 409
 *   - mutating routes reject a token-bearing UNAUTHENTICATED request (tokens
 *     grant no writes)
 */

import type { DatabaseClient } from '@revealui/db/client';
import * as schema from '@revealui/db/schema';
import { OpenAPIHono } from '@revealui/openapi';
import { HTTPException } from 'hono/http-exception';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createTestDb,
  type TestDb,
} from '../../../../../packages/test/src/utils/drizzle-test-db.js';
import { mintPreviewToken } from '../content/_helpers/preview-token.js';
import type { ContentVariables } from '../content/index.js';
import sessionsRoutes from '../content/sessions.js';

const SECRET = 'preview-endpoint-test-secret';
const MARKETING_URL = 'https://www.example-preview.test';
const ADMIN_URL = 'https://admin.example-preview.test';

process.env.REVEALUI_PREVIEW_TOKEN_SECRET = SECRET;
process.env.REVEALUI_PUBLIC_SERVER_URL = MARKETING_URL;
process.env.ADMIN_URL = ADMIN_URL;

let testDb: TestDb;

interface UserCtx {
  id: string;
  role: string;
}

const EDITOR: UserCtx = { id: 'user-editor', role: 'editor' };
const VIEWER: UserCtx = { id: 'user-viewer', role: 'viewer' };

const SITE_ID = 'site-1';
const PAGE_ID = 'page-1';
const OTHER_SITE = 'site-2';
const OTHER_PAGE = 'page-2';

function createApp(user: UserCtx | null) {
  const app = new OpenAPIHono<{ Variables: ContentVariables }>();
  app.use('*', async (c, next) => {
    if (user) c.set('user', user);
    c.set('db', testDb.drizzle as unknown as DatabaseClient);
    await next();
  });
  app.route('/', sessionsRoutes);
  app.onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'Internal server error' }, 500);
  });
  return app;
}

async function seedBase(): Promise<void> {
  const db = testDb.drizzle;
  await db.insert(schema.users).values([
    { id: EDITOR.id, name: 'Editor', email: 'editor@example.com', role: 'editor' },
    { id: VIEWER.id, name: 'Viewer', email: 'viewer@example.com', role: 'viewer' },
  ]);
  await db.insert(schema.sites).values([
    { id: SITE_ID, ownerId: EDITOR.id, name: 'Site One', slug: 'site-one', status: 'published' },
    { id: OTHER_SITE, ownerId: EDITOR.id, name: 'Site Two', slug: 'site-two', status: 'published' },
  ]);
  await db.insert(schema.pages).values([
    {
      id: PAGE_ID,
      siteId: SITE_ID,
      title: 'Home',
      slug: 'about',
      path: '/about',
      status: 'published',
      version: 1,
      blocks: [{ type: 'text', text: 'hello' }],
      seo: null,
    },
    {
      id: OTHER_PAGE,
      siteId: OTHER_SITE,
      title: 'Other',
      slug: 'other',
      path: '/other',
      status: 'published',
      version: 1,
      blocks: [],
      seo: null,
    },
  ]);
}

async function openSession(app: ReturnType<typeof createApp>): Promise<string> {
  const res = await app.request('/sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ siteId: SITE_ID, title: 'My edits' }),
  });
  expect(res.status).toBe(201);
  const body = (await res.json()) as { data: { id: string } };
  return body.data.id;
}

async function materializeDoc(app: ReturnType<typeof createApp>, sessionId: string): Promise<void> {
  const res = await app.request(`/sessions/${sessionId}/docs/page/${PAGE_ID}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: 'title', value: 'Draft Home' }),
  });
  expect(res.status).toBe(200);
}

beforeEach(async () => {
  testDb = await createTestDb();
  await seedBase();
});

afterAll(async () => {
  await testDb?.close();
});

// ---------------------------------------------------------------------------
// Mint
// ---------------------------------------------------------------------------

describe('POST /sessions/:id/preview-token', () => {
  it('mints a token and a previewUrl carrying the edit params (page path)', async () => {
    const app = createApp(EDITOR);
    const sessionId = await openSession(app);

    const res = await app.request(`/sessions/${sessionId}/preview-token?pageId=${PAGE_ID}`, {
      method: 'POST',
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      data: { token: string; expiresAt: string; previewUrl: string };
    };
    expect(body.data.token).toContain('.');
    const url = new URL(body.data.previewUrl);
    expect(url.origin).toBe(MARKETING_URL);
    expect(url.pathname).toBe('/about');
    expect(url.searchParams.get('rvui-edit')).toBe(body.data.token);
    expect(url.searchParams.get('rvui-session')).toBe(sessionId);
    expect(new Date(body.data.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('defaults to the site root when no pageId is given', async () => {
    const app = createApp(EDITOR);
    const sessionId = await openSession(app);
    const res = await app.request(`/sessions/${sessionId}/preview-token`, { method: 'POST' });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { previewUrl: string } };
    expect(new URL(body.data.previewUrl).pathname).toBe('/');
  });

  it('rejects a pageId that belongs to a different site', async () => {
    const app = createApp(EDITOR);
    const sessionId = await openSession(app);
    const res = await app.request(`/sessions/${sessionId}/preview-token?pageId=${OTHER_PAGE}`, {
      method: 'POST',
    });
    expect(res.status).toBe(404);
  });

  it('rejects anonymous (401) and non-editor (403)', async () => {
    const editorApp = createApp(EDITOR);
    const sessionId = await openSession(editorApp);

    const anon = await createApp(null).request(`/sessions/${sessionId}/preview-token`, {
      method: 'POST',
    });
    expect(anon.status).toBe(401);

    const viewer = await createApp(VIEWER).request(`/sessions/${sessionId}/preview-token`, {
      method: 'POST',
    });
    expect(viewer.status).toBe(403);
  });

  it('rejects minting for a non-open session (409)', async () => {
    const app = createApp(EDITOR);
    const sessionId = await openSession(app);
    await app.request(`/sessions/${sessionId}/discard`, { method: 'POST' });
    const res = await app.request(`/sessions/${sessionId}/preview-token`, { method: 'POST' });
    expect(res.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// GET /preview
// ---------------------------------------------------------------------------

describe('GET /sessions/:id/preview', () => {
  it('returns docs + adminOrigin for a valid token, no cookie required', async () => {
    const app = createApp(EDITOR);
    const sessionId = await openSession(app);
    await materializeDoc(app, sessionId);
    const { token } = mintPreviewToken(SECRET, sessionId);

    // No user context on this request  -  token is the only credential.
    const res = await createApp(null).request(`/sessions/${sessionId}/preview?token=${token}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('no-store');
    const body = (await res.json()) as {
      data: {
        siteId: string;
        adminOrigin: string;
        docs: Array<{ docType: string; docId: string; draft: { title: string } }>;
      };
    };
    expect(body.data.siteId).toBe(SITE_ID);
    expect(body.data.adminOrigin).toBe(ADMIN_URL);
    expect(body.data.docs).toHaveLength(1);
    expect(body.data.docs[0]).toMatchObject({ docType: 'page', docId: PAGE_ID });
    expect(body.data.docs[0].draft.title).toBe('Draft Home');
  });

  it('rejects a missing token (400) and never leaks docs', async () => {
    const app = createApp(EDITOR);
    const sessionId = await openSession(app);
    await materializeDoc(app, sessionId);
    const res = await createApp(null).request(`/sessions/${sessionId}/preview`);
    expect(res.status).toBe(400);
    expect(await res.text()).not.toContain('Draft Home');
  });

  it('rejects a bad token (401) and never leaks docs', async () => {
    const app = createApp(EDITOR);
    const sessionId = await openSession(app);
    await materializeDoc(app, sessionId);
    const res = await createApp(null).request(
      `/sessions/${sessionId}/preview?token=garbage.forged`,
    );
    expect(res.status).toBe(401);
    expect(await res.text()).not.toContain('Draft Home');
  });

  it('rejects an expired token (401)', async () => {
    const app = createApp(EDITOR);
    const sessionId = await openSession(app);
    const expired = mintPreviewToken(SECRET, sessionId, -10).token;
    const res = await createApp(null).request(`/sessions/${sessionId}/preview?token=${expired}`);
    expect(res.status).toBe(401);
  });

  it('rejects a token minted for a different session (403)', async () => {
    const app = createApp(EDITOR);
    const sessionA = await openSession(app);
    const sessionB = await openSession(app);
    const tokenForA = mintPreviewToken(SECRET, sessionA).token;
    const res = await createApp(null).request(`/sessions/${sessionB}/preview?token=${tokenForA}`);
    expect(res.status).toBe(403);
  });

  it('rejects preview of a non-open session (409)', async () => {
    const app = createApp(EDITOR);
    const sessionId = await openSession(app);
    const token = mintPreviewToken(SECRET, sessionId).token;
    await app.request(`/sessions/${sessionId}/discard`, { method: 'POST' });
    const res = await createApp(null).request(`/sessions/${sessionId}/preview?token=${token}`);
    expect(res.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// Tokens grant NO writes
// ---------------------------------------------------------------------------

describe('preview tokens never authorize mutations', () => {
  it('a token-bearing UNAUTHENTICATED PATCH is rejected (401)', async () => {
    const editorApp = createApp(EDITOR);
    const sessionId = await openSession(editorApp);
    const token = mintPreviewToken(SECRET, sessionId).token;

    // Attach the token as a query param on the mutating route and send NO user.
    const res = await createApp(null).request(
      `/sessions/${sessionId}/docs/page/${PAGE_ID}?token=${token}`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: 'title', value: 'hacked' }),
      },
    );
    expect(res.status).toBe(401);
  });

  it('a token-bearing UNAUTHENTICATED publish is rejected (401)', async () => {
    const editorApp = createApp(EDITOR);
    const sessionId = await openSession(editorApp);
    const token = mintPreviewToken(SECRET, sessionId).token;
    const res = await createApp(null).request(`/sessions/${sessionId}/publish?token=${token}`, {
      method: 'POST',
    });
    expect(res.status).toBe(401);
  });
});
