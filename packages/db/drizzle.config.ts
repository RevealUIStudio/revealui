import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  // Schema location
  schema: './src/schema/index.ts',
  
  // Output directory for migrations
  out: './drizzle',
  
  // Database dialect
  dialect: 'postgresql',
  
  // Connection configuration
  // Uses DATABASE_URL from environment
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  
  // Generate verbose SQL
  verbose: true,
  
  // Strict mode - fail on warnings
  strict: true,
})
