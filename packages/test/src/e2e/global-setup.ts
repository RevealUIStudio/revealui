/**
 * Global setup for E2E tests
 * Verifies server is running and accessible before tests execute
 */

import { chromium, type FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL || 'http://localhost:3000';
  const healthURL = `${baseURL}/api/health`;

  console.log(`[E2E Setup] Verifying server at ${baseURL}...`);

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Wait for server to be ready with retries
    let retries = 10;
    let lastError: Error | null = null;

    while (retries > 0) {
      try {
        const response = await page.goto(healthURL, {
          waitUntil: 'networkidle',
          timeout: 5000,
        });

        // Accept 200, 401 (auth required), or 404 (endpoint doesn't exist but server is up)
        if (
          response &&
          (response.status() === 200 || response.status() === 401 || response.status() === 404)
        ) {
          console.log(`[E2E Setup] ✅ Server is ready (HTTP ${response.status()})`);
          await browser.close();
          return;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }

      retries--;
      if (retries > 0) {
        console.log(`[E2E Setup] Server not ready, retrying... (${retries} attempts left)`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    // If we get here, all retries failed
    const errorMessage = lastError?.message || 'Unknown error';
    throw new Error(
      `E2E test setup failed - server not ready at ${baseURL}: ${errorMessage}. ` +
        'Start the server with `pnpm dev` in apps/admin or apps/mainframe. ' +
        'E2E tests require a running server instance.',
    );
  } finally {
    await browser.close();
  }
}

export default globalSetup;
