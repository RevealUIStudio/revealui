import { Client } from 'pg'
import { createRequire } from 'node:module'
import crypto from 'node:crypto'

const require = createRequire(import.meta.url)
const bcrypt = require('../packages/auth/node_modules/bcryptjs')

const POSTGRES_URL = process.env.POSTGRES_URL
if (!POSTGRES_URL) {
  console.error('POSTGRES_URL is required')
  process.exit(1)
}

const email = process.env.ADMIN_EMAIL || 'admin@example.com'
const password = process.env.ADMIN_PASSWORD
if (!password) {
  console.error('ADMIN_PASSWORD is required (set via environment variable)')
  process.exit(1)
}
const name = process.env.ADMIN_NAME || 'Admin User'

const client = new Client({ connectionString: POSTGRES_URL })

try {
  await client.connect()

  // Check if user already exists in neon_auth
  const existing = await client.query('SELECT id FROM neon_auth."user" WHERE email = $1', [email])
  if (existing.rows.length > 0) {
    console.log('Admin user already exists in neon_auth:', existing.rows[0].id)
    process.exit(0)
  }

  const userId = crypto.randomUUID()
  const accountId = crypto.randomUUID()
  const now = new Date().toISOString()

  // Hash password with bcrypt (salt rounds 12, matching auth module)
  const hashedPassword = await bcrypt.hash(password, 12)
  console.log('Password hashed')

  // Insert into neon_auth.user (better-auth)
  await client.query(
    `INSERT INTO neon_auth."user" (id, name, email, "emailVerified", role, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, true, $4, $5, $6)`,
    [userId, name, email, 'admin', now, now],
  )
  console.log('neon_auth.user created:', userId)

  // Insert into neon_auth.account with hashed password
  await client.query(
    `INSERT INTO neon_auth.account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [accountId, userId, 'credential', userId, hashedPassword, now, now],
  )
  console.log('neon_auth.account created with hashed password')

  // Also ensure public.users has the user (for CMS access control)
  const pubUser = await client.query('SELECT id FROM users WHERE email = $1', [email])
  if (pubUser.rows.length === 0) {
    await client.query(
      'INSERT INTO users (id, name, email, role, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [userId, name, email, 'super-admin', 'active', now, now],
    )
    console.log('public.users created')
  } else {
    console.log('public.users already exists:', pubUser.rows[0].id)
  }

  // Verify
  const check = await client.query('SELECT id, email, role FROM neon_auth."user" WHERE email = $1', [
    email,
  ])
  console.log('Verified neon_auth:', JSON.stringify(check.rows[0]))
} catch (e) {
  console.error('ERROR:', e.message)
  process.exit(1)
} finally {
  await client.end()
}
