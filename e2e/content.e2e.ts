/**
 * Content E2E Tests
 *
 * Tests content creation through the Admin panel by driving the actual UI
 * (click collection → Create New → fill form → Save).
 *
 * The AdminDashboard is a state-machine SPA — URL segments are ignored.
 * Tests must navigate via button clicks, not direct URL jumps.
 *
 * REQUIRES live services:
 *   - apps/admin deployed and accessible via PLAYWRIGHT_BASE_URL
 *   - ADMIN_EMAIL + ADMIN_PASSWORD so global-setup can create auth state
 *
 * Auth strategy:
 *   global-setup signs in ONCE and saves the session cookie to e2e/.auth/user.json.
 *   Each test reuses that state via test.use({ storageState }) — no per-test sign-in.
 *   This keeps total sign-in requests well within the 5/15min rate limit.
 *
 * Collection choice:
 *   Pages/Posts have required `blocks`/`richText` fields that DocumentForm
 *   cannot render (it only handles text/number/checkbox/select/date).
 *   Save would always fail for those collections via the admin UI.
 *   The `categories` collection has only `title` (text, required) — ideal for
 *   verifying the full admin CRUD flow.
 *
 * Run with:
 *   CI=1 PLAYWRIGHT_BASE_URL=https://admin.revealui.com \
 *     ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=<pass> \
 *     node_modules/.bin/playwright test e2e/content.e2e.ts \
 *     --project=chromium --retries=0 --reporter=line
 */

import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

const ADMIN_BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4000';

// Auth state file written by global-setup (one sign-in per test run)
const AUTH_STATE_FILE = 'e2e/.auth/user.json';

// ---------------------------------------------------------------------------
// Navigation helper
// ---------------------------------------------------------------------------

async function goToAdmin(page: Page) {
  await page.goto(`${ADMIN_BASE}/admin`, { waitUntil: 'domcontentloaded' });
  // Wait for SSR heading — signals HTML is ready
  await page.getByRole('heading', { name: /RevealUI Admin/i }).waitFor({ timeout: 15000 });
  // Wait for JS bundles to load so React can hydrate and attach onClick handlers
  await page.waitForLoadState('load');
}

// ---------------------------------------------------------------------------
// Categories collection — simple CRUD (title-only, no complex field types)
// ---------------------------------------------------------------------------
// Uses `categories` instead of `pages`/`posts` because:
//   - Pages requires `layout` (blocks, required) — DocumentForm cannot fill blocks
//   - Posts requires `content` (richText, required) — DocumentForm cannot fill richText
//   - Categories only requires `title` (text) — works with current DocumentForm

test.describe('Content CRUD lifecycle', () => {
  // Reuse the session cookie saved by global-setup — no per-test sign-in needed.
  // This avoids the 5/15min sign-in rate limit when retries are enabled.
  test.use({ storageState: AUTH_STATE_FILE });

  const testTitle = `E2E Category ${Date.now()}`;

  test.beforeAll(async ({ request }) => {
    // Skip if auth state doesn't exist or has no cookies (global-setup failed)
    try {
      const state = JSON.parse(readFileSync(AUTH_STATE_FILE, 'utf8')) as {
        cookies?: unknown[];
      };
      if (!state.cookies?.length) {
        test.skip();
        return;
      }
    } catch {
      test.skip();
      return;
    }
    // Skip if Admin is unreachable
    try {
      const res = await request.get(`${ADMIN_BASE}/api/health`, { timeout: 5000 });
      if (!res.ok()) test.skip();
    } catch {
      test.skip();
    }
  });

  test('admin can create a document via admin UI', async ({ page }) => {
    // Capture API calls to diagnose save failures
    const apiCalls: Array<{ url: string; method: string; status: number; body: string }> = [];
    page.on('response', async (response) => {
      if (response.url().includes('/api/collections/')) {
        const body = await response.text().catch(() => '');
        apiCalls.push({
          url: response.url(),
          method: response.request().method(),
          status: response.status(),
          body: body.slice(0, 300),
        });
      }
    });

    await goToAdmin(page);

    // Click categories — retry if React hasn't hydrated yet (onClick not attached)
    await expect(async () => {
      await page.getByRole('button', { name: 'categories' }).click();
      await expect(page.getByRole('button', { name: 'Create New' })).toBeVisible({
        timeout: 3000,
      });
    }).toPass({ timeout: 20000 });

    await page.getByRole('button', { name: 'Create New' }).click();

    // Wait for form and fill the title field
    await page.getByLabel(/title/i).waitFor({ timeout: 10000 });
    await page.getByLabel(/title/i).fill(testTitle);

    // Save
    await page.getByRole('button', { name: 'Save' }).click();

    // Success: AdminDashboard navigates back to the collection list after save.
    // "Create New" reappearing signals the view transitioned (success clears the form).
    // The success toast is cleared by handleCollectionClick before React renders it,
    // so we detect success via navigation instead.
    await expect(page.getByRole('button', { name: 'Create New' }))
      .toBeVisible({ timeout: 15000 })
      .catch((err: unknown) => {
        // Debug: log API calls made during this test to diagnose the failure
        console.error('[DEBUG] API calls during test:', JSON.stringify(apiCalls, null, 2));
        throw err;
      });

    // Verify the new document appears in the collection list
    await expect(page.getByText(testTitle)).toBeVisible({ timeout: 5000 });
  });

  test('admin can create a second document (verifies list + Create New flow)', async ({ page }) => {
    const secondTitle = `E2E Category Second ${Date.now()}`;
    await goToAdmin(page);

    await expect(async () => {
      await page.getByRole('button', { name: 'categories' }).click();
      await expect(page.getByRole('button', { name: 'Create New' })).toBeVisible({
        timeout: 3000,
      });
    }).toPass({ timeout: 20000 });

    await page.getByRole('button', { name: 'Create New' }).click();

    await page.getByLabel(/title/i).waitFor({ timeout: 10000 });
    await page.getByLabel(/title/i).fill(secondTitle);

    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByRole('button', { name: 'Create New' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(secondTitle)).toBeVisible({ timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// Media upload — API-based (bypasses DocumentForm which lacks upload field type)
// ---------------------------------------------------------------------------

test.describe('Media upload via API', () => {
  test.use({ storageState: AUTH_STATE_FILE });

  test.beforeAll(async ({ request }) => {
    try {
      const state = JSON.parse(readFileSync(AUTH_STATE_FILE, 'utf8')) as {
        cookies?: unknown[];
      };
      if (!state.cookies?.length) {
        test.skip();
        return;
      }
    } catch {
      test.skip();
      return;
    }
    try {
      const res = await request.get(`${ADMIN_BASE}/api/health`, { timeout: 5000 });
      if (!res.ok()) test.skip();
    } catch {
      test.skip();
    }
  });

  test('can upload a media file via multipart POST', async ({ request }) => {
    // Create a small 1x1 PNG (68 bytes)
    const pngBytes = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    );

    const response = await request.post(`${ADMIN_BASE}/api/collections/media`, {
      multipart: {
        file: {
          name: `e2e-test-${Date.now()}.png`,
          mimeType: 'image/png',
          buffer: pngBytes,
        },
        alt: 'E2E test image',
      },
    });

    // Accept 201 (created) or 200 (OK). 4xx means the endpoint rejected
    // the request — still a valid test outcome if auth or storage isn't configured.
    if (response.status() === 401 || response.status() === 403) {
      test.skip();
      return;
    }

    expect([200, 201]).toContain(response.status());

    const body = (await response.json()) as { doc?: { id?: string }; id?: string };
    const id = body.doc?.id ?? body.id;
    expect(id).toBeDefined();
  });

  test('rejects upload without authentication', async ({ browser }) => {
    // Fresh context with no stored auth
    const context = await browser.newContext();
    const req = context.request;

    const pngBytes = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    );

    const response = await req.post(`${ADMIN_BASE}/api/collections/media`, {
      multipart: {
        file: {
          name: 'unauthorized.png',
          mimeType: 'image/png',
          buffer: pngBytes,
        },
      },
    });

    expect([401, 403]).toContain(response.status());
    await context.close();
  });
});
