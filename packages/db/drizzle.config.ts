import { defineConfig } from 'drizzle-kit'

// Use process.env directly - drizzle-kit has issues with ESM imports in config files
// POSTGRES_URL or DATABASE_URL should be set by the calling script
const dbUrl = process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? ''

if (!dbUrl) {
  throw new Error('POSTGRES_URL or DATABASE_URL must be set')
}

export default defineConfig({
  // Schema location
  schema: './src/core/index.ts',

  // Output directory for migrations
  out: './drizzle',

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
})
