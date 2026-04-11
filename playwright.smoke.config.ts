/**
 * Playwright Smoke Test Configuration
 *
 * Lightweight config for smoke tests that run without live services.
 * Uses chromium only, no globalSetup (no DB or auth required).
 *
 * Run with: pnpm test:e2e:smoke
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/smoke.e2e.ts',

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,

  reporter: [['list'], ['json', { outputFile: 'playwright-report/smoke-results.json' }]],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4000',
    trace: 'on-first-retry',
    actionTimeout: 10000,
    navigationTimeout: 15000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // No globalSetup  -  smoke tests must work without DB/auth setup
  // No webServer  -  caller is responsible for starting services
  outputDir: 'test-results/smoke',
  timeout: 20000,
  expect: { timeout: 5000 },
});
