/**
 * Rich Text (Lexical) E2E Tests — Phase 2.1
 *
 * Tests two things:
 *   1. UI — Admin creates a Post via the Lexical editor in the admin panel.
 *            The `content` richText field is now rendered by DocumentForm after
 *            the Phase 2.1 fix (tabs flattened, richText case added to FieldInput).
 *   2. Serialization roundtrip — POST a Lexical JSON blob directly via API and
 *            GET it back; verify the JSON structure round-trips correctly.
 *
 * Collection: `posts` (has title: text + content: richText, both required).
 * The server-side required check is shallow (top-level only), so the API test
 * can omit `content` without triggering a 400. The UI test fills both.
 *
 * Run with:
 *   CI=1 PLAYWRIGHT_BASE_URL=https://admin.revealui.com \
 *     CMS_ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=<pass> \
 *     node_modules/.bin/playwright test e2e/richtext.e2e.ts \
 *     --project=chromium --retries=0 --reporter=line
 */

import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

const CMS_BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4000';
const AUTH_STATE_FILE = 'e2e/.auth/user.json';

// Minimal Lexical editor state with a single paragraph
const LEXICAL_HELLO = {
  root: {
    type: 'root',
    version: 1,
    direction: 'ltr',
    format: '',
    indent: 0,
    children: [
      {
        type: 'paragraph',
        version: 1,
        direction: 'ltr',
        format: '',
        indent: 0,
        children: [
          {
            type: 'text',
            version: 1,
            text: 'Hello from E2E',
            format: 0,
            style: '',
            mode: 'normal',
            detail: 0,
          },
        ],
      },
    ],
  },
};

async function goToAdmin(page: Page) {
  await page.goto(`${CMS_BASE}/admin`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: /RevealUI Admin/i }).waitFor({ timeout: 15000 });
  await page.waitForLoadState('load');
}

// ---------------------------------------------------------------------------
// Auth guard (shared across both describe blocks)
// ---------------------------------------------------------------------------

async function skipIfNoAuth(
  request: Parameters<Parameters<typeof test.beforeAll>[0]>[0]['request'],
) {
  try {
    const state = JSON.parse(readFileSync(AUTH_STATE_FILE, 'utf8')) as { cookies?: unknown[] };
    if (!state.cookies?.length) {
      test.skip();
      return;
    }
  } catch {
    test.skip();
    return;
  }
  try {
    const res = await request.get(`${CMS_BASE}/api/health`, { timeout: 5000 });
    if (!res.ok()) test.skip();
  } catch {
    test.skip();
  }
}

// ---------------------------------------------------------------------------
// 1. UI test — Lexical editor renders and creates a post
// ---------------------------------------------------------------------------

test.describe('Rich text editor — admin UI', () => {
  test.use({ storageState: AUTH_STATE_FILE });

  const postTitle = `E2E Post ${Date.now()}`;

  test.beforeAll(async ({ request }) => {
    await skipIfNoAuth(request);
  });

  test('admin can create a post with rich text content via the Lexical editor', async ({
    page,
  }) => {
    const apiCalls: Array<{ url: string; status: number; body: string }> = [];
    page.on('response', async (response) => {
      if (response.url().includes('/api/collections/posts')) {
        const body = await response.text().catch(() => '');
        apiCalls.push({ url: response.url(), status: response.status(), body: body.slice(0, 400) });
      }
    });

    await goToAdmin(page);

    // Navigate to posts collection
    await expect(async () => {
      await page.getByRole('button', { name: 'posts' }).click();
      await expect(page.getByRole('button', { name: 'Create New' })).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 20000 });

    await page.getByRole('button', { name: 'Create New' }).click();

    // Fill title
    await page.getByLabel(/title/i).waitFor({ timeout: 10000 });
    await page.getByLabel(/title/i).fill(postTitle);

    // Wait for Lexical editor to mount (contenteditable div with editor-input class)
    const editor = page.locator('[contenteditable="true"].editor-input').first();
    await editor.waitFor({ timeout: 10000 });
    await editor.click();
    await page.keyboard.type('Hello from E2E');

    // Save
    await page.getByRole('button', { name: 'Save' }).click();

    // Success: navigates back to list, "Create New" reappears
    await expect(page.getByRole('button', { name: 'Create New' }))
      .toBeVisible({ timeout: 15000 })
      .catch((err: unknown) => {
        console.error('[DEBUG] API calls:', JSON.stringify(apiCalls, null, 2));
        throw err;
      });

    // Post title appears in the list
    await expect(page.getByText(postTitle)).toBeVisible({ timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// 2. Serialization roundtrip — API-based, no UI
// ---------------------------------------------------------------------------

test.describe('Rich text serialization roundtrip', () => {
  test.use({ storageState: AUTH_STATE_FILE });

  test.beforeAll(async ({ request }) => {
    await skipIfNoAuth(request);
  });

  test('Lexical JSON round-trips through create → read intact', async ({ request }) => {
    const title = `E2E Roundtrip ${Date.now()}`;

    // Create a post with explicit Lexical content
    const createRes = await request.post(`${CMS_BASE}/api/collections/posts`, {
      data: { title, content: LEXICAL_HELLO },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(createRes.status()).toBe(200);

    const created = (await createRes.json()) as { id: string; content?: typeof LEXICAL_HELLO };
    expect(created.id).toBeTruthy();

    // Read it back
    const readRes = await request.get(`${CMS_BASE}/api/collections/posts/${created.id}`);
    expect(readRes.status()).toBe(200);

    const doc = (await readRes.json()) as { content?: typeof LEXICAL_HELLO };

    // Verify the JSON structure round-tripped
    expect(doc.content).toBeDefined();
    expect(doc.content?.root?.type).toBe('root');

    const paragraph = doc.content?.root?.children?.[0];
    expect(paragraph?.type).toBe('paragraph');

    const textNode = paragraph?.children?.[0];
    expect(textNode?.type).toBe('text');
    expect(textNode?.text).toBe('Hello from E2E');
  });
});
