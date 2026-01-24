import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('Missing DATABASE_URL in .env file')
}

export default defineConfig({
  dialect: 'sqlite',
  schema: './database/drizzle/schema/*',
  out: './database/migrations',

  dbCredentials: {
    url: databaseUrl,
  },
})
