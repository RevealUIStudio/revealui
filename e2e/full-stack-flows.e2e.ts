/**
 * Full-stack proofs: browser signup → POST /api/auth/sign-up → users row.
 *
 * FH-003 / F-062-0003: this file used to be one describe.skip. It posted
 * /api/auth/signup (the live admin route is /api/auth/sign-up) and opened
 * /signup-with-profile, which is not a route. The registration cases below
 * follow apps/admin/src/app/(frontend)/signup/SignupForm.tsx. They run when
 * admin and the same database admin writes are reachable, and they skip
 * with a reason otherwise. The multi-record rollback stays skipped: that
 * transaction is not a product surface.
 */

import { mkdir } from 'node:fs/promises';
import { expect, type Page, type Response, test } from '@playwright/test';
import {
  cleanupTestData,
  createTestDb,
  type DbTestHelper,
  waitForDbRecord,
} from './utils/db-helpers';
import { waitForApiResponse } from './utils/test-helpers';

const ADMIN_BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4000';
const ADMIN_HEALTH_TIMEOUT_MS = 3000;
const SIGNUP_SETTLE_TIMEOUT_MS = 15_000;
const SIGNUP_HAPPY_PATH_TIMEOUT_MS = 60_000;
const USERS_TABLE = 'users';
const EMAIL_COLUMN = 'email';
const TEST_USER_NAME = 'Test User';
const TOS_CHECKBOX_NAME = 'Accept the Terms of Service and Privacy Policy';

const SKIP_ADMIN =
  'FH-003: admin is not reachable at PLAYWRIGHT_BASE_URL (default http://localhost:4000/api/health)';
const SKIP_DB =
  'FH-003: test database is not reachable. Set TEST_DATABASE_URL or DATABASE_URL to the database admin writes.';
const SKIP_SIGNUP_RESTRICTED = 'FH-003: signups are restricted (REVEALUI_SIGNUP_OPEN is not true)';
const SKIP_WAITLISTED = 'FH-003: free signup is waitlisted on this deployment';
const SKIP_RATE_LIMIT = 'FH-003: sign-up rate limit is active (5 attempts per 15 minutes)';
const SKIP_SIGNUP_REDIRECT =
  'FH-003: /signup redirected; the form is not available in this session';
const SKIP_MULTI_RECORD =
  'FH-003 / F-062-0003: /signup-with-profile is not a route. There is no users-and-posts signup transaction to roll back.';

interface SignUpResponseBody {
  user?: {
    email?: string;
    name?: string;
    emailVerified?: boolean;
  };
  error?: string;
  message?: string;
  code?: string;
}

interface SignupFields {
  name: string;
  email: string;
  password: string;
}

function uniqueEmail(label: string): string {
  return `e2e-fs-${label}-${crypto.randomUUID()}@revealui-test.com`;
}

function signupPassword(): string {
  // Unique so the breach check does not reject a shared fixture password.
  return `E2eFs${crypto.randomUUID()}Aa1`;
}

function isSignedUpDestination(url: URL): boolean {
  return url.pathname === '/welcome' || url.pathname.startsWith('/account/billing');
}

async function readSignUpBody(response: Response): Promise<SignUpResponseBody> {
  try {
    return (await response.json()) as SignUpResponseBody;
  } catch {
    return {};
  }
}

function skipOnSignupEnvironment(status: number, body: SignUpResponseBody): void {
  if (status === 403 || body.code === 'SIGNUP_RESTRICTED') {
    test.skip(true, SKIP_SIGNUP_RESTRICTED);
  }
  if (status === 202 || body.code === 'WAITLISTED') {
    test.skip(true, SKIP_WAITLISTED);
  }
  if (status === 429) {
    test.skip(true, SKIP_RATE_LIMIT);
  }
}

async function openSignup(page: Page): Promise<void> {
  await page.goto(`${ADMIN_BASE}/signup`, { waitUntil: 'domcontentloaded' });
  if (!page.url().includes('/signup')) {
    test.skip(true, SKIP_SIGNUP_REDIRECT);
  }
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible({
    timeout: SIGNUP_SETTLE_TIMEOUT_MS,
  });
}

async function fillSignup(page: Page, fields: SignupFields): Promise<void> {
  await page.locator('#name').fill(fields.name);
  await page.locator('#email').fill(fields.email);
  await page.locator('#password').fill(fields.password);
  await page.getByRole('checkbox', { name: TOS_CHECKBOX_NAME }).click();
}

async function submitSignup(page: Page): Promise<Response> {
  const responsePromise = waitForApiResponse(page, '/api/auth/sign-up', 'POST');
  await page.getByRole('button', { name: 'Create account' }).click();
  return responsePromise;
}

test.describe('Full-Stack User Flows', () => {
  test.describe.configure({ mode: 'serial' });

  let db: DbTestHelper | null = null;
  let adminReady = false;
  const emailsToCleanup: string[] = [];

  function requireDb(): DbTestHelper {
    test.skip(!adminReady, SKIP_ADMIN);
    test.skip(!db, SKIP_DB);
    if (!db) {
      throw new Error('database helper missing after skip');
    }
    return db;
  }

  test.beforeAll(async ({ request }) => {
    try {
      const health = await request.get(`${ADMIN_BASE}/api/health`, {
        timeout: ADMIN_HEALTH_TIMEOUT_MS,
      });
      adminReady = health.ok();
    } catch {
      adminReady = false;
    }

    if (!adminReady) return;

    const helper = createTestDb();
    try {
      await helper.connect();
      await helper.query('SELECT 1');
      db = helper;
    } catch {
      await helper.disconnect().catch(() => {
        // connect() failed before a client existed
      });
    }
  });

  test.afterAll(async () => {
    if (!db) return;
    await db.disconnect();
    db = null;
  });

  test.afterEach(async () => {
    if (!db) return;
    for (const email of emailsToCleanup) {
      await cleanupTestData(db, USERS_TABLE, { column: EMAIL_COLUMN, value: email });
    }
    emailsToCleanup.length = 0;
  });

  test('should not create user in database with invalid email', async ({ page }) => {
    const database = requireDb();
    const email = 'invalid-email';
    emailsToCleanup.push(email);

    await openSignup(page);
    await fillSignup(page, {
      name: TEST_USER_NAME,
      email,
      password: signupPassword(),
    });

    let postedSignUp = false;
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().includes('/api/auth/sign-up')) {
        postedSignUp = true;
      }
    });

    await page.getByRole('button', { name: 'Create account' }).click();

    const emailValid = await page.locator('#email').evaluate((element) => {
      return element instanceof HTMLInputElement ? element.validity.valid : true;
    });
    expect(emailValid).toBe(false);
    expect(postedSignUp).toBe(false);
    expect(page.url()).toContain('/signup');

    const matches = await database.count(USERS_TABLE, { column: EMAIL_COLUMN, value: email });
    expect(matches).toBe(0);
  });

  test('should not insert a user when the password is rejected', async ({ page }) => {
    const database = requireDb();
    const email = uniqueEmail('reject');
    emailsToCleanup.push(email);

    await openSignup(page);
    await fillSignup(page, {
      name: TEST_USER_NAME,
      email,
      password: 'short',
    });
    // The input minLength blocks submit before the API. Drop it so the
    // live contract (min 12) is what rejects the row.
    await page.locator('#password').evaluate((element) => {
      if (element instanceof HTMLInputElement) {
        element.minLength = 0;
        element.removeAttribute('minlength');
      }
    });

    const response = await submitSignup(page);
    const status = response.status();
    const body = await readSignUpBody(response);
    skipOnSignupEnvironment(status, body);
    expect(status, body.message ?? body.error ?? 'expected validation failure').toBe(400);
    await expect(page.getByRole('alert')).toBeVisible();

    const matches = await database.count(USERS_TABLE, { column: EMAIL_COLUMN, value: email });
    expect(matches).toBe(0);
  });

  test('should create user in database when signing up from browser', async ({ page }) => {
    test.setTimeout(SIGNUP_HAPPY_PATH_TIMEOUT_MS);
    const database = requireDb();
    const email = uniqueEmail('signup');
    emailsToCleanup.push(email);

    await openSignup(page);
    await fillSignup(page, {
      name: TEST_USER_NAME,
      email,
      password: signupPassword(),
    });

    const response = await submitSignup(page);
    const status = response.status();
    const body = await readSignUpBody(response);
    skipOnSignupEnvironment(status, body);
    expect(status, body.message ?? body.error ?? 'sign-up failed').toBe(200);

    const user = await waitForDbRecord<{ email: string; name: string }>(database, USERS_TABLE, {
      column: EMAIL_COLUMN,
      value: email,
    });
    expect(user).toBeTruthy();
    expect(user?.email).toBe(email);
    expect(user?.name).toBe(TEST_USER_NAME);

    await expect
      .poll(
        async () => {
          if (await page.getByRole('heading', { name: 'Check your inbox' }).isVisible()) {
            return 'inbox';
          }
          if (isSignedUpDestination(new URL(page.url()))) return 'destination';
          return '';
        },
        { timeout: SIGNUP_SETTLE_TIMEOUT_MS },
      )
      .not.toBe('');

    await mkdir('test-results/full-stack', { recursive: true });
    await page.screenshot({
      path: 'test-results/full-stack/user-registration-success.png',
      fullPage: true,
    });
  });
});

test.describe('Full-Stack User Flows — known gaps', () => {
  test('should rollback database changes on a multi-record signup error', async () => {
    test.skip(true, SKIP_MULTI_RECORD);
  });
});
