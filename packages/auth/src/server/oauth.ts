/**
 * OAuth Core — State Management + User Upsert
 *
 * CSRF state: signed cookie using HMAC-SHA256 over a base64url payload.
 * Provider dispatch: routes to Google / GitHub / Vercel provider modules.
 * User upsert: links OAuth identities to local users via oauth_accounts table.
 */

import crypto from 'node:crypto'
import { logger } from '@revealui/core/observability/logger'
import { getClient } from '@revealui/db/client'
import { oauthAccounts, users } from '@revealui/db/schema'
import { and, eq } from 'drizzle-orm'
import type { User } from '../types.js'
import * as github from './providers/github.js'
import * as google from './providers/google.js'
import * as vercel from './providers/vercel.js'

export interface ProviderUser {
  id: string
  email: string | null
  name: string
  avatarUrl: string | null
}

// =============================================================================
// CSRF State
// =============================================================================

/**
 * Generate a signed OAuth state token.
 *
 * State encodes provider + redirectTo + nonce as base64url JSON.
 * Cookie value is `<state>.<hmac>` — the HMAC is over the state string
 * using REVEALUI_SECRET, providing CSRF protection without a DB table.
 */
export function generateOAuthState(
  provider: string,
  redirectTo: string,
): { state: string; cookieValue: string } {
  const nonce = crypto.randomBytes(16).toString('hex')
  const payload = JSON.stringify({ provider, redirectTo, nonce })
  const state = Buffer.from(payload).toString('base64url')
  const secret = process.env.REVEALUI_SECRET
  if (!secret) {
    throw new Error(
      'REVEALUI_SECRET is required for OAuth state signing. ' +
        'Set it in your environment variables.',
    )
  }
  const hmac = crypto.createHmac('sha256', secret).update(state).digest('hex')
  return { state, cookieValue: `${state}.${hmac}` }
}

/**
 * Verify a signed OAuth state token from the callback.
 *
 * Returns the decoded provider + redirectTo if valid, null otherwise.
 */
export function verifyOAuthState(
  state: string | null | undefined,
  cookieValue: string | null | undefined,
): { provider: string; redirectTo: string } | null {
  if (!(state && cookieValue)) return null

  const dotIdx = cookieValue.lastIndexOf('.')
  if (dotIdx === -1) return null

  const storedState = cookieValue.substring(0, dotIdx)
  const storedHmac = cookieValue.substring(dotIdx + 1)

  // State from query param must match what's in the cookie
  if (storedState !== state) return null

  const secret = process.env.REVEALUI_SECRET
  if (!secret) {
    throw new Error(
      'REVEALUI_SECRET is required for OAuth state verification. ' +
        'Set it in your environment variables.',
    )
  }
  const expectedHmac = crypto.createHmac('sha256', secret).update(state).digest('hex')

  // Both are hex-encoded SHA-256 HMACs — must be exactly 64 hex characters.
  // Reject wrong-length inputs immediately; do NOT pad (padding enables forged matches
  // where a short storedHmac is zero-padded to collide with the expected hash).
  if (storedHmac.length !== 64 || expectedHmac.length !== 64) return null
  try {
    if (!crypto.timingSafeEqual(Buffer.from(storedHmac, 'hex'), Buffer.from(expectedHmac, 'hex'))) {
      return null
    }
  } catch {
    return null
  }

  try {
    const parsed = JSON.parse(Buffer.from(state, 'base64url').toString()) as {
      provider: string
      redirectTo: string
      nonce: string
    }
    return { provider: parsed.provider, redirectTo: parsed.redirectTo }
  } catch {
    return null
  }
}

// =============================================================================
// Provider Dispatch
// =============================================================================

const PROVIDERS = ['google', 'github', 'vercel'] as const
type Provider = (typeof PROVIDERS)[number]

function isProvider(p: string): p is Provider {
  return (PROVIDERS as readonly string[]).includes(p)
}

function getClientId(provider: Provider): string {
  const map: Record<Provider, string | undefined> = {
    google: process.env.GOOGLE_CLIENT_ID,
    github: process.env.GITHUB_CLIENT_ID,
    vercel: process.env.VERCEL_CLIENT_ID,
  }
  const id = map[provider]
  if (!id) throw new Error(`Missing client ID for provider: ${provider}`)
  return id
}

export function buildAuthUrl(provider: string, redirectUri: string, state: string): string {
  if (!isProvider(provider)) throw new Error(`Unknown provider: ${provider}`)
  const clientId = getClientId(provider)
  const builders: Record<Provider, typeof google.buildAuthUrl> = {
    google: google.buildAuthUrl,
    github: github.buildAuthUrl,
    vercel: vercel.buildAuthUrl,
  }
  return builders[provider](clientId, redirectUri, state)
}

export async function exchangeCode(
  provider: string,
  code: string,
  redirectUri: string,
): Promise<string> {
  if (!isProvider(provider)) throw new Error(`Unknown provider: ${provider}`)
  const exchangers: Record<Provider, typeof google.exchangeCode> = {
    google: google.exchangeCode,
    github: github.exchangeCode,
    vercel: vercel.exchangeCode,
  }
  return exchangers[provider](code, redirectUri)
}

export async function fetchProviderUser(
  provider: string,
  accessToken: string,
): Promise<ProviderUser> {
  if (!isProvider(provider)) throw new Error(`Unknown provider: ${provider}`)
  const fetchers: Record<Provider, typeof google.fetchUser> = {
    google: google.fetchUser,
    github: github.fetchUser,
    vercel: vercel.fetchUser,
  }
  return fetchers[provider](accessToken)
}

// =============================================================================
// User Upsert
// =============================================================================

/**
 * Find or create a local user for the given OAuth identity.
 *
 * Flow:
 * 1. Look up oauth_accounts by (provider, providerUserId) → get userId
 * 2. If found: refresh metadata + return user
 * 3. If not found: check users by email → link if match
 * 4. If no match: create new user (role: 'admin', no password)
 * 5. Insert oauth_accounts row
 */
export async function upsertOAuthUser(provider: string, providerUser: ProviderUser): Promise<User> {
  const db = getClient()

  // 1. Check for existing linked account
  const [existingAccount] = await db
    .select()
    .from(oauthAccounts)
    .where(
      and(eq(oauthAccounts.provider, provider), eq(oauthAccounts.providerUserId, providerUser.id)),
    )
    .limit(1)

  if (existingAccount) {
    // Refresh provider metadata (name/email/avatar may have changed)
    await db
      .update(oauthAccounts)
      .set({
        providerEmail: providerUser.email,
        providerName: providerUser.name,
        providerAvatarUrl: providerUser.avatarUrl,
        updatedAt: new Date(),
      })
      .where(eq(oauthAccounts.id, existingAccount.id))

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, existingAccount.userId))
      .limit(1)

    if (!user) {
      logger.error(
        `oauth_accounts row ${existingAccount.id} references missing user ${existingAccount.userId}`,
      )
      throw new Error('OAuth account references a deleted user')
    }
    return user as User
  }

  // 2. Check for existing user by email (account linking)
  let userId: string
  let isNewUser = false

  if (providerUser.email) {
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, providerUser.email))
      .limit(1)

    if (existingUser) {
      userId = existingUser.id
    } else {
      isNewUser = true
      userId = crypto.randomUUID()
    }
  } else {
    isNewUser = true
    userId = crypto.randomUUID()
  }

  // 3. Create user if none found
  if (isNewUser) {
    await db.insert(users).values({
      id: userId,
      name: providerUser.name,
      email: providerUser.email,
      avatarUrl: providerUser.avatarUrl,
      password: null,
      role: 'user',
      status: 'active',
    })
  }

  // 4. Insert oauth_accounts link
  await db.insert(oauthAccounts).values({
    id: crypto.randomUUID(),
    userId,
    provider,
    providerUserId: providerUser.id,
    providerEmail: providerUser.email,
    providerName: providerUser.name,
    providerAvatarUrl: providerUser.avatarUrl,
  })

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user) throw new Error('Failed to fetch upserted OAuth user')
  return user as User
}
