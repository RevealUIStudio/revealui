/**
 * Playwright Global Setup
 *
 * Runs once before all tests
 */

import { chromium, type FullConfig } from '@playwright/test'

async function globalSetup(_config: FullConfig) {
  console.log('🎭 Starting Playwright E2E test setup...')

  // You can add global setup tasks here:
  // - Seed test database
  // - Start services
  // - Generate test data
  // - Authenticate and save state

  // Example: Create authenticated state for reuse across tests
  const browser = await chromium.launch()
  const _page = await browser.newPage()

  // Navigate to login page (if needed)
  // await page.goto('http://localhost:3000/login')
  // await page.fill('[name="email"]', 'test@example.com')
  // await page.fill('[name="password"]', 'password123')
  // await page.click('[type="submit"]')

  // Save signed-in state to 'storageState.json'
  // await page.context().storageState({ path: 'e2e/.auth/storageState.json' })

  await browser.close()

  console.log('✅ Playwright E2E test setup complete')
}

export default globalSetup
