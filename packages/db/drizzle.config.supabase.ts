import { defineConfig } from 'drizzle-kit'

/**
 * Drizzle config for Supabase (Vector Database)
 *
 * This config is used for managing the vector database schema in Supabase.
 * It uses the vector.ts schema which only includes agent_memories table.
 *
 * Usage:
 *   DATABASE_URL=<supabase-connection-string> pnpm drizzle-kit --config=drizzle.config.supabase.ts <command>
 */

// Use DATABASE_URL for Supabase (vector database)
const dbUrl = process.env.DATABASE_URL ?? ''

if (!dbUrl) {
  throw new Error('DATABASE_URL must be set for Supabase vector database')
}

export default defineConfig({
  // Schema location - only vector schemas
  schema: './src/schema/vector.ts',

  // Output directory for migrations
  out: './drizzle/supabase',

  // Database dialect
  dialect: 'postgresql',

  // Connection configuration
  dbCredentials: {
    url: dbUrl,
  },

  // Generate verbose SQL
  verbose: true,

  // Strict mode - fail on warnings
  strict: true,

  // Introspection configuration
  introspect: {
    casing: 'camel',
  },
})
