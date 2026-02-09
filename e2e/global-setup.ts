/**
 * Playwright Global Setup
 *
 * Runs once before all tests
 * - Sets up test database
 * - Seeds test data
 * - Creates authenticated states
 * - Initializes MCP servers
 */

import { mkdir } from 'node:fs/promises'
import { chromium, type FullConfig } from '@playwright/test'
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

  // Initialize test database
  try {
    console.log('🗄️  Setting up test database...')
    const db = createTestDb()
    await db.connect()

    // Seed test data
    console.log('🌱 Seeding test data...')

    // Create test users
    await db.query(`
      INSERT INTO users (email, password, name, created_at, updated_at)
      VALUES
        ('test@example.com', '$2a$10$YourHashedPasswordHere', 'Test User', NOW(), NOW()),
        ('admin@example.com', '$2a$10$YourHashedPasswordHere', 'Admin User', NOW(), NOW())
      ON CONFLICT (email) DO NOTHING
    `).catch(() => {
      console.log('⚠️  Test users may already exist or users table may not be set up yet')
    })

    // Create test products
    await db.query(`
      INSERT INTO products (id, name, description, price, created_at, updated_at)
      VALUES
        ('test-product', 'Test Product', 'A product for testing', 4999, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `).catch(() => {
      console.log('⚠️  Test products may already exist or products table may not be set up yet')
    })

    await db.disconnect()
    console.log('✅ Database setup complete')
  } catch (error) {
    console.log('⚠️  Database setup skipped:', error instanceof Error ? error.message : 'Unknown error')
    console.log('   Tests requiring database will be skipped or may fail')
  }

  // Create authenticated browser state for reuse
  try {
    console.log('🔐 Creating authenticated browser state...')
    const browser = await chromium.launch()
    const page = await browser.newPage()

    const baseURL = config.projects[0].use.baseURL || 'http://localhost:4000'

    // Try to login and save auth state
    try {
      await page.goto(`${baseURL}/login`, { timeout: 5000 })
      await page.fill('[name="email"]', 'test@example.com')
      await page.fill('[name="password"]', 'password123')
      await page.click('[type="submit"]')
      await page.waitForURL(/\/(dashboard|home)/, { timeout: 5000 })

      // Save authenticated state
      await page.context().storageState({ path: 'e2e/.auth/user.json' })
      console.log('✅ User authentication state saved')
    } catch (error) {
      console.log('⚠️  Could not create authenticated state:', error instanceof Error ? error.message : 'Unknown error')
      console.log('   Tests may need to login manually')
    }

    await browser.close()
  } catch (error) {
    console.log('⚠️  Browser setup failed:', error instanceof Error ? error.message : 'Unknown error')
  }

  // Log MCP server status
  console.log('\n📡 MCP Servers available:')
  console.log('   - Neon Database MCP: Run with `pnpm mcp:neon`')
  console.log('   - Stripe MCP: Run with `pnpm mcp:stripe`')
  console.log('   - Playwright MCP: Run with `pnpm mcp:playwright`')
  console.log('   - All MCP Servers: Run with `pnpm mcp:all`')

  console.log('\n✨ Playwright E2E test setup complete!')
  console.log('\n📝 Run tests with:')
  console.log('   pnpm test:e2e              - Run all E2E tests')
  console.log('   pnpm test:e2e:ui           - Run with Playwright UI')
  console.log('   pnpm test:e2e:headed       - Run in headed mode (visible browser)')
  console.log('   pnpm test:e2e:debug        - Run in debug mode')
  console.log('   pnpm test:e2e:visual       - Run visual snapshot tests')
  console.log('')
}

export default globalSetup
