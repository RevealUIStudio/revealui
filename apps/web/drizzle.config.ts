import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  // No DATABASE_URL present — assume local pglite (electric) will be used in development
  // Drizzle migrations may require a real DATABASE_URL; set it in CI or provide one locally.
  // We do not throw here to allow local dev without a managed Postgres instance.
  console.warn('No DATABASE_URL found — drizzle will assume local pglite or CI-provided Postgres')
}

export default defineConfig({
  dialect: 'pg',
  schema: './database/drizzle/schema/*',
  out: './database/migrations',

  dbCredentials: {
    url: databaseUrl,
  },
})
