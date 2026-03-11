/**
 * Playwright Global Teardown
 *
 * Runs once after all tests
 */

async function globalTeardown() {
  console.log('🧹 Starting Playwright E2E test cleanup...');

  // You can add global cleanup tasks here:
  // - Clean up test database
  // - Stop services
  // - Delete test data
  // - Remove temporary files

  console.log('✅ Playwright E2E test cleanup complete');
}

export default globalTeardown;
