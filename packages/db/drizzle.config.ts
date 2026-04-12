import { defineConfig } from 'drizzle-kit';

// Use process.env directly - drizzle-kit has issues with ESM imports in config files
// POSTGRES_URL or DATABASE_URL should be set by the calling script
const dbUrl = process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? '';

// Only warn at configure time  -  generate works without a live connection.
// Avoid console.* (banned by pre-commit hook); use process.stderr directly.
if (!dbUrl && process.env.DRIZZLE_REQUIRE_URL !== 'false') {
  process.stderr.write(
    'Warning: POSTGRES_URL or DATABASE_URL not set. db:migrate and db:push will fail.\n',
  );
}

export default defineConfig({
  // Schema location
  schema: './dist/schema/index.js',

  // Output directory for migrations (fixed to match actual location)
  out: './migrations',

  // Database dialect
  dialect: 'postgresql',

  // Connection configuration
  // Uses config module if available, otherwise process.env
  dbCredentials: {
    url: dbUrl,
  },

  // Generate verbose SQL
  verbose: true,

  // Strict mode - fail on warnings
  strict: true,

  // Introspection configuration
  // When enabled, Drizzle Kit can introspect the database and compare with schemas
  // Use: drizzle-kit introspect
  // This helps validate that schemas match the actual database structure
  introspect: {
    // Enable introspection mode (used by drizzle-kit introspect command)
    // This allows validating schemas against actual database
    casing: 'camel',
  },
});
