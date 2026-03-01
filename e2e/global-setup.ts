/**
 * Playwright Global Setup
 *
 * Runs once before all tests:
 * - Creates output directories
 * - Optionally seeds test database (requires TEST_DATABASE_URL)
 * - Optionally saves authenticated browser state (requires CMS_ADMIN_EMAIL + CMS_ADMIN_PASSWORD)
 *
 * All steps are best-effort — failures are logged and skipped, never throw.
 *
 * Required env vars for authenticated state:
 *   CMS_ADMIN_EMAIL=admin@example.com
 *   CMS_ADMIN_PASSWORD=your-password
 *
 * Required env vars for DB seeding:
 *   TEST_DATABASE_URL=postgresql://...
 */

/* eslint-disable no-console */
/* console-allowed */

import { mkdir, writeFile } from 'node:fs/promises'
import { chromium, expect, type FullConfig } from '@playwright/test'
import { createTestDb } from './utils/db-helpers'

async function globalSetup(config: FullConfig) {
  console.log('🎭 Starting Playwright E2E test setup...')

  // Create necessary directories
  await mkdir('test-results/full-stack', { recursive: true })
  await mkdir('test-results/payments', { recursive: true })
  await mkdir('test-results/screenshots', { recursive: true })
  await mkdir('test-results/videos', { recursive: true })
  await mkdir('test-results/traces', { recursive: true })
  await mkdir('e2e/.auth', { recursive: true })

  console.log('📁 Created test result directories')

  // Seed test database (only runs when TEST_DATABASE_URL is set)
  if (process.env.TEST_DATABASE_URL) {
    try {
      console.log('🗄️  Setting up test database...')
      const db = createTestDb()
      await db.connect()

      // Seed test products (users are created via the CMS signup API in auth tests)
      await db
        .query(`
        INSERT INTO products (id, name, description, price, created_at, updated_at)
        VALUES
          ('test-product', 'Test Product', 'A product for testing', 4999, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `)
        .catch(() => {
          console.log('⚠️  Test products may already exist or products table may not be set up yet')
        })

      await db.disconnect()
      console.log('✅ Database setup complete')
    } catch (error) {
      console.log(
        '⚠️  Database setup skipped:',
        error instanceof Error ? error.message : 'Unknown error',
      )
      console.log('   Tests requiring database will be skipped or may fail')
    }
  } else {
    console.log('ℹ️  TEST_DATABASE_URL not set — skipping DB seeding')
  }

  // Save authenticated browser state for reuse across tests
  // Requires CMS_ADMIN_EMAIL and CMS_ADMIN_PASSWORD in environment
  const adminEmail = process.env.CMS_ADMIN_EMAIL
  const adminPassword = process.env.CMS_ADMIN_PASSWORD

  // SKIP_GLOBAL_AUTH=1 lets E2E suites that do per-test signIn skip this slot,
  // keeping the total sign-in count within the rate limit window (5/15min).
  if (adminEmail && adminPassword && !process.env.SKIP_GLOBAL_AUTH) {
    try {
      console.log('🔐 Creating authenticated browser state...')
      const browser = await chromium.launch()
      const page = await browser.newPage()

      const baseURL = config.projects[0].use.baseURL || 'http://localhost:4000'

      // CMS login page is at /login (not /admin/login).
      // Use waitUntil:'load' so React hydrates before clicking Sign in
      // (domcontentloaded fires before JS executes, causing a hydration race).
      await page.goto(`${baseURL}/login`, { waitUntil: 'load', timeout: 30000 })

      await page.getByLabel(/email/i).fill(adminEmail)
      await page
        .getByLabel(/password/i)
        .first()
        .fill(adminPassword)

      // Retry the click until the URL leaves /login (handles hydration timing)
      await expect(async () => {
        await page.getByRole('button', { name: /sign in|log in/i }).click()
        await expect(page).not.toHaveURL(/\/login/, { timeout: 5000 })
      }).toPass({ timeout: 30000 })

      await page.context().storageState({ path: 'e2e/.auth/user.json' })
      console.log('✅ Authenticated browser state saved to e2e/.auth/user.json')

      await browser.close()
    } catch (error) {
      console.log(
        '⚠️  Could not create authenticated state:',
        error instanceof Error ? error.message : 'Unknown error',
      )
      console.log('   Set CMS_ADMIN_EMAIL and CMS_ADMIN_PASSWORD to enable pre-authenticated tests')
      // Write empty auth state so storageState: 'e2e/.auth/user.json' never throws ENOENT
      await writeFile('e2e/.auth/user.json', JSON.stringify({ cookies: [], origins: [] })).catch(
        () => undefined,
      )
    }
  } else {
    console.log('ℹ️  CMS_ADMIN_EMAIL/CMS_ADMIN_PASSWORD not set — skipping auth state creation')
    // Write empty auth state so storageState: 'e2e/.auth/user.json' never throws ENOENT
    await writeFile('e2e/.auth/user.json', JSON.stringify({ cookies: [], origins: [] })).catch(
      () => undefined,
    )
  }

  console.log('\n✨ Playwright E2E test setup complete!')
}

export default globalSetup
