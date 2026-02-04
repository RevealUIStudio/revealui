import { defineConfig } from 'drizzle-kit'

// Use process.env directly - drizzle-kit has issues with ESM imports in config files
// POSTGRES_URL or DATABASE_URL should be set by the calling script
const dbUrl = process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? ''

if (!dbUrl) {
  throw new Error('POSTGRES_URL or DATABASE_URL must be set')
}

export default defineConfig({
  // Schema location
  schema: './dist/schema/index.js',

  // Output directory for migrations
  out: './src/orm/drizzle',

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
})
