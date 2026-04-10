import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 *
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: [
    ['html', { open: 'never' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
    ['junit', { outputFile: 'playwright-report/junit.xml' }],
    ['list'],
  ],

  // Shared settings for all the projects below
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4000',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',

    // Maximum time each action can take
    actionTimeout: 10000,

    // Navigation timeout
    navigationTimeout: 30000,
  },

  // Configure projects for major browsers
  // CI only installs Chromium — limit to chromium-based projects there
  projects: process.env.CI
    ? [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
        { name: 'tablet', use: { ...devices['iPad Pro'] } },
      ]
    : [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
        { name: 'webkit', use: { ...devices['Desktop Safari'] } },
        { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
        { name: 'mobile-safari', use: { ...devices['iPhone 12'] } },
        { name: 'tablet', use: { ...devices['iPad Pro'] } },
      ],

  // Run your local dev server before starting the tests
  webServer: process.env.CI
    ? undefined
    : {
        command: 'pnpm dev:admin',
        url: 'http://localhost:4000',
        reuseExistingServer: !process.env.CI,
        timeout: 300000, // 5 minutes for initial build
        stdout: 'pipe',
        stderr: 'pipe',
      },

  // Global setup/teardown
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',

  // Output directory for test artifacts
  outputDir: 'test-results/',

  // Maximum time one test can run for
  timeout: 30000,

  // Expect timeout
  expect: {
    timeout: 5000,
    // Visual snapshot configuration
    toHaveScreenshot: {
      // Maximum pixel difference ratio for snapshots
      maxDiffPixelRatio: 0.01,
      // Threshold for individual pixel color difference (0-1)
      threshold: 0.2,
      // Animations to disable for consistent snapshots
      animations: 'disabled',
      // Scale factor
      scale: 'css',
    },
  },

  // Snapshot path configuration
  snapshotDir: './e2e/__snapshots__',
  snapshotPathTemplate: '{snapshotDir}/{testFileDir}/{testFileName}/{arg}-{projectName}{ext}',
});
