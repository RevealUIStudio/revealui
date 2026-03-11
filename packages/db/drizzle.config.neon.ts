import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle config for Neon (REST Database)
 *
 * This config is used for managing the REST database schema in Neon.
 * It uses the rest.ts schema which only includes agent_memories table.
 *
 * Usage:
 *   DATABASE_URL=<neon-connection-string> pnpm drizzle-kit --config=drizzle.config.neon.ts <command>
 */

// Use DATABASE_URL for Neon (REST database)
const dbUrl = process.env.POSTGRES_URL ?? '';

if (!dbUrl) {
  throw new Error('POSTGRES_URL must be set for Neon database');
}

export default defineConfig({
  // Schema location - only vector schemas
  schema: './src/schema/rest.ts',

  // Output directory for migrations
  out: './drizzle/neon',

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
});
