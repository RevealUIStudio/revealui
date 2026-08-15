/**
 * Playwright Global Setup
 *
 * Runs once before all tests:
 * - Creates output directories
 * - Optionally seeds test database (requires TEST_DATABASE_URL)
 * - Optionally saves authenticated browser state (requires ADMIN_EMAIL + ADMIN_PASSWORD)
 *
 * All steps are best-effort  -  failures are logged and skipped, never throw.
 *
 * Required env vars for authenticated state:
 *   ADMIN_EMAIL=admin@example.com
 *   ADMIN_PASSWORD=your-password
 *
 * Required env vars for DB seeding:
 *   TEST_DATABASE_URL=postgresql://...
 */

/* console-allowed */

import { mkdir, writeFile } from 'node:fs/promises';
import type { FullConfig } from '@playwright/test';
import { consentStorageState } from './utils/consent';
import { createTestDb } from './utils/db-helpers';

function emptyAuthState(baseURL: string): string {
  return JSON.stringify(consentStorageState(baseURL));
}

/**
 * Sign in via the admin API and build a Playwright storageState JSON.
 * Avoids the browser hydration race (Next.js SSR + React onClick timing).
 */
async function signInViaAPI(baseURL: string, email: string, password: string): Promise<string> {
  const res = await fetch(`${baseURL}/api/auth/sign-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Sign-in failed (${res.status}): ${body}`);
  }

  // getSetCookie() returns ALL Set-Cookie headers as an array (Node 24 / undici).
  // get('set-cookie') returns only the first header — which is `revealui-role`,
  // not the `revealui-session` cookie the API authenticates on.
  const setCookieHeaders = res.headers.getSetCookie();
  if (setCookieHeaders.length === 0) {
    throw new Error('Sign-in succeeded but no Set-Cookie headers returned');
  }

  const defaultDomain = new URL(baseURL).hostname;

  interface ParsedCookie {
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'Lax' | 'Strict' | 'None';
  }

  function parseSetCookieHeader(header: string): ParsedCookie | null {
    const parts = header.split(';').map((s) => s.trim());
    const nameValue = parts[0];
    if (!nameValue) return null;
    const eqIdx = nameValue.indexOf('=');
    if (eqIdx === -1) return null;
    const name = nameValue.substring(0, eqIdx);
    const value = nameValue.substring(eqIdx + 1);
    if (!name) return null;

    let domain = defaultDomain;
    let path = '/';
    let expires = -1;
    let httpOnly = false;
    let secure = false;
    let sameSite: 'Lax' | 'Strict' | 'None' = 'Lax';

    for (const attr of parts.slice(1)) {
      const lower = attr.toLowerCase();
      if (lower.startsWith('domain=')) domain = attr.substring(7);
      else if (lower.startsWith('path=')) path = attr.substring(5);
      else if (lower.startsWith('max-age='))
        expires = Math.floor(Date.now() / 1000) + parseInt(attr.substring(8), 10);
      else if (lower.startsWith('expires='))
        expires = Math.floor(Date.parse(attr.substring(8)) / 1000);
      else if (lower === 'httponly') httpOnly = true;
      else if (lower === 'secure') secure = true;
      else if (lower.startsWith('samesite=')) {
        const v = attr.substring(9).toLowerCase();
        sameSite = v === 'strict' ? 'Strict' : v === 'none' ? 'None' : 'Lax';
      }
    }

    return { name, value, domain, path, expires, httpOnly, secure, sameSite };
  }

  const cookies: ParsedCookie[] = [];
  for (const header of setCookieHeaders) {
    const parsed = parseSetCookieHeader(header);
    if (parsed) cookies.push(parsed);
  }

  if (cookies.length === 0) {
    throw new Error('Sign-in succeeded but no cookies could be parsed from Set-Cookie headers');
  }

  const consent = consentStorageState(baseURL);
  return JSON.stringify({
    cookies: [...cookies, ...consent.cookies],
    origins: consent.origins,
  });
}

async function globalSetup(config: FullConfig) {
  console.log('🎭 Starting Playwright E2E test setup...');

  // Create necessary directories
  await mkdir('test-results/full-stack', { recursive: true });
  await mkdir('test-results/payments', { recursive: true });
  await mkdir('test-results/screenshots', { recursive: true });
  await mkdir('test-results/videos', { recursive: true });
  await mkdir('test-results/traces', { recursive: true });
  await mkdir('e2e/.auth', { recursive: true });

  console.log('📁 Created test result directories');

  // Seed test database (only runs when TEST_DATABASE_URL is set)
  if (process.env.TEST_DATABASE_URL) {
    try {
      console.log('🗄️  Setting up test database...');
      const db = createTestDb();
      await db.connect();

      // Seed test products (users are created via the admin signup API in auth tests)
      await db
        .query(`
        INSERT INTO products (id, name, description, price, created_at, updated_at)
        VALUES
          ('test-product', 'Test Product', 'A product for testing', 4999, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `)
        .catch(() => {
          console.log('⚠️  Test products may already exist or products table may not be set up yet');
        });

      await db.disconnect();
      console.log('✅ Database setup complete');
    } catch (error) {
      console.log(
        '⚠️  Database setup skipped:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      console.log('   Tests requiring database will be skipped or may fail');
    }
  } else {
    console.log('ℹ️  TEST_DATABASE_URL not set  -  skipping DB seeding');
  }

  // Save authenticated browser state for reuse across tests
  // Requires ADMIN_EMAIL and ADMIN_PASSWORD in environment
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (adminEmail && adminPassword && !process.env.SKIP_GLOBAL_AUTH) {
    const baseURL = config.projects[0].use.baseURL || 'http://localhost:4000';
    try {
      console.log('🔐 Creating authenticated browser state via API...');
      // Use the API directly  -  avoids Next.js hydration race when clicking the
      // Sign In button via browser (onClick not attached until React hydrates).
      const state = await signInViaAPI(baseURL, adminEmail, adminPassword);
      await writeFile('e2e/.auth/user.json', state);
      console.log('✅ Authenticated browser state saved to e2e/.auth/user.json');
    } catch (error) {
      console.log(
        '⚠️  Could not create authenticated state:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      console.log('   Set ADMIN_EMAIL and ADMIN_PASSWORD to enable pre-authenticated tests');
      // Preserve existing auth state if it has valid cookies  -  don't overwrite with empty
      // state just because the refresh failed (e.g. rate-limited). Tests can still reuse
      // the previous session cookie if it hasn't expired.
      try {
        const existing = JSON.parse(
          await (await import('node:fs/promises')).readFile('e2e/.auth/user.json', 'utf8'),
        );
        if (Array.isArray(existing?.cookies) && existing.cookies.length > 0) {
          console.log('   ℹ️  Preserving existing auth state (has valid cookies)');
        } else {
          await writeFile('e2e/.auth/user.json', emptyAuthState(baseURL)).catch(() => undefined);
        }
      } catch {
        await writeFile('e2e/.auth/user.json', emptyAuthState(baseURL)).catch(() => undefined);
      }
    }
  } else {
    console.log('ℹ️  ADMIN_EMAIL/ADMIN_PASSWORD not set  -  skipping auth state creation');
    const baseURL = config.projects[0].use.baseURL || 'http://localhost:4000';
    // Same preservation logic: keep existing session cookies if present
    try {
      const existing = JSON.parse(
        await (await import('node:fs/promises')).readFile('e2e/.auth/user.json', 'utf8'),
      );
      if (!(Array.isArray(existing?.cookies) && existing.cookies.length > 0)) {
        await writeFile('e2e/.auth/user.json', emptyAuthState(baseURL)).catch(() => undefined);
      }
    } catch {
      await writeFile('e2e/.auth/user.json', emptyAuthState(baseURL)).catch(() => undefined);
    }
  }

  console.log('\n✨ Playwright E2E test setup complete!');
}

export default globalSetup;
