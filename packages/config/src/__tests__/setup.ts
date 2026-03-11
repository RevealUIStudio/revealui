import { afterAll, beforeAll, beforeEach } from 'vitest';

// Store original environment
let originalEnv: NodeJS.ProcessEnv;

beforeAll(() => {
  // Store original env before any modifications
  originalEnv = { ...process.env };

  // Completely clear environment for tests
  // Remove ALL environment variables that could interfere
  Object.keys(process.env).forEach((key) => {
    if (
      key.startsWith('REVEALUI_') ||
      key.startsWith('STRIPE_') ||
      key.startsWith('POSTGRES_') ||
      key.startsWith('DATABASE_URL') ||
      key.startsWith('SUPABASE_') ||
      key.startsWith('BLOB_') ||
      key.startsWith('NEXT_PUBLIC_') ||
      key === 'NODE_ENV'
    ) {
      Reflect.deleteProperty(process.env, key);
    }
  });

  // Set minimal test environment
  process.env.NODE_ENV = 'test';
  process.env.SKIP_ENV_VALIDATION = 'true';
});

// Reset environment before each test
beforeEach(() => {
  // Ensure clean slate for each test
  Object.keys(process.env).forEach((key) => {
    if (
      key.startsWith('REVEALUI_') ||
      key.startsWith('STRIPE_') ||
      key.startsWith('POSTGRES_') ||
      key.startsWith('DATABASE_URL') ||
      key.startsWith('SUPABASE_') ||
      key.startsWith('BLOB_') ||
      key.startsWith('NEXT_PUBLIC_')
    ) {
      Reflect.deleteProperty(process.env, key);
    }
  });

  process.env.NODE_ENV = 'test';
  process.env.SKIP_ENV_VALIDATION = 'true';
});

// Restore original environment after all tests
afterAll(() => {
  // Restore original environment
  process.env = { ...originalEnv };
});
