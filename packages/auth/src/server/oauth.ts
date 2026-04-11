/**
 * OAuth Core  -  State Management + User Upsert
 *
 * CSRF state: signed cookie using HMAC-SHA256 over a base64url payload.
 * Provider dispatch: routes to Google / GitHub / Vercel provider modules.
 * User upsert: links OAuth identities to local users via oauth_accounts table.
 */

import crypto from 'node:crypto';
import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db/client';
import { oauthAccounts, users } from '@revealui/db/schema';
import { and, eq } from 'drizzle-orm';
import type { User } from '../types.js';
import { OAuthAccountConflictError } from './errors.js';
import * as github from './providers/github.js';
import * as google from './providers/google.js';
import * as vercel from './providers/vercel.js';

export interface ProviderUser {
  id: string;
  email: string | null;
  name: string;
  avatarUrl: string | null;
}

// =============================================================================
// CSRF State
// =============================================================================

/**
 * Generate a signed OAuth state token.
 *
 * State encodes provider + redirectTo + nonce as base64url JSON.
 * Cookie value is `<state>.<hmac>`  -  the HMAC is over the state string
 * using REVEALUI_SECRET, providing CSRF protection without a DB table.
 */
export function generateOAuthState(
  provider: string,
  redirectTo: string,
  options?: { linkConsent?: boolean },
): { state: string; cookieValue: string; codeChallenge: string } {
  const nonce = crypto.randomBytes(16).toString('hex');
  // PKCE: generate a code_verifier (RFC 7636 §4.1  -  32 random bytes → 43 base64url chars)
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  const payload = JSON.stringify({
    provider,
    redirectTo,
    nonce,
    cv: codeVerifier,
    ...(options?.linkConsent ? { linkConsent: true } : {}),
  });
  const state = Buffer.from(payload).toString('base64url');
  const secret = process.env.REVEALUI_SECRET;
  if (!secret) {
    throw new Error(
      'REVEALUI_SECRET is required for OAuth state signing. ' +
        'Set it in your environment variables.',
    );
  }
  const hmac = crypto.createHmac('sha256', secret).update(state).digest('hex');
  return { state, cookieValue: `${state}.${hmac}`, codeChallenge };
}

/**
 * Verify a signed OAuth state token from the callback.
 *
 * Returns the decoded provider + redirectTo if valid, null otherwise.
 */
export function verifyOAuthState(
  state: string | null | undefined,
  cookieValue: string | null | undefined,
): { provider: string; redirectTo: string; linkConsent?: boolean; codeVerifier?: string } | null {
  if (!(state && cookieValue)) return null;

  const dotIdx = cookieValue.lastIndexOf('.');
  if (dotIdx === -1) return null;

  const storedState = cookieValue.substring(0, dotIdx);
  const storedHmac = cookieValue.substring(dotIdx + 1);

  // State from query param must match what's in the cookie (timing-safe)
  if (
    storedState.length !== state.length ||
    !crypto.timingSafeEqual(Buffer.from(storedState), Buffer.from(state))
  ) {
    return null;
  }

  const secret = process.env.REVEALUI_SECRET;
  if (!secret) {
    throw new Error(
      'REVEALUI_SECRET is required for OAuth state verification. ' +
        'Set it in your environment variables.',
    );
  }
  const expectedHmac = crypto.createHmac('sha256', secret).update(state).digest('hex');

  // Both are hex-encoded SHA-256 HMACs  -  must be exactly 64 hex characters.
  // Reject wrong-length inputs immediately; do NOT pad (padding enables forged matches
  // where a short storedHmac is zero-padded to collide with the expected hash).
  if (storedHmac.length !== 64 || expectedHmac.length !== 64) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(storedHmac, 'hex'), Buffer.from(expectedHmac, 'hex'))) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(state, 'base64url').toString()) as {
      provider: string;
      redirectTo: string;
      nonce: string;
      cv?: string;
      linkConsent?: boolean;
    };
    return {
      provider: parsed.provider,
      redirectTo: parsed.redirectTo,
      ...(parsed.linkConsent ? { linkConsent: true } : {}),
      ...(parsed.cv ? { codeVerifier: parsed.cv } : {}),
    };
  } catch {
    return null;
  }
}

// =============================================================================
// Provider Dispatch
// =============================================================================

const PROVIDERS = ['google', 'github', 'vercel'] as const;
type Provider = (typeof PROVIDERS)[number];

function isProvider(p: string): p is Provider {
  return (PROVIDERS as readonly string[]).includes(p);
}

function getClientId(provider: Provider): string {
  const map: Record<Provider, string | undefined> = {
    google: process.env.GOOGLE_CLIENT_ID,
    github: process.env.GITHUB_CLIENT_ID,
    vercel: process.env.VERCEL_CLIENT_ID,
  };
  const id = map[provider];
  if (!id) throw new Error(`Missing client ID for provider: ${provider}`);
  return id;
}

export function buildAuthUrl(
  provider: string,
  redirectUri: string,
  state: string,
  codeChallenge?: string,
): string {
  if (!isProvider(provider)) throw new Error(`Unknown provider: ${provider}`);
  const clientId = getClientId(provider);
  const builders: Record<Provider, typeof google.buildAuthUrl> = {
    google: google.buildAuthUrl,
    github: github.buildAuthUrl,
    vercel: vercel.buildAuthUrl,
  };
  return builders[provider](clientId, redirectUri, state, codeChallenge);
}

export async function exchangeCode(
  provider: string,
  code: string,
  redirectUri: string,
  codeVerifier?: string,
): Promise<string> {
  if (!isProvider(provider)) throw new Error(`Unknown provider: ${provider}`);
  const exchangers: Record<Provider, typeof google.exchangeCode> = {
    google: google.exchangeCode,
    github: github.exchangeCode,
    vercel: vercel.exchangeCode,
  };
  return exchangers[provider](code, redirectUri, codeVerifier);
}

export async function fetchProviderUser(
  provider: string,
  accessToken: string,
): Promise<ProviderUser> {
  if (!isProvider(provider)) throw new Error(`Unknown provider: ${provider}`);
  const fetchers: Record<Provider, typeof google.fetchUser> = {
    google: google.fetchUser,
    github: github.fetchUser,
    vercel: vercel.fetchUser,
  };
  return fetchers[provider](accessToken);
}

// =============================================================================
// User Upsert
// =============================================================================

export interface UpsertOAuthOptions {
  /**
   * When true, the user has explicitly consented to link their OAuth
   * provider to an existing local account with the same email.
   * Without consent, an email-match throws OAuthAccountConflictError.
   */
  linkConsent?: boolean;
}

/**
 * Find or create a local user for the given OAuth identity.
 *
 * Flow:
 * 1. Look up oauth_accounts by (provider, providerUserId) → get userId
 * 2. If found: refresh metadata + return user
 * 3. If not found: check users by email → link if match (with consent) or throw
 * 4. If no match: create new user (role: 'user', no password)
 * 5. Insert oauth_accounts row
 */
export async function upsertOAuthUser(
  provider: string,
  providerUser: ProviderUser,
  options?: UpsertOAuthOptions,
): Promise<User> {
  const db = getClient();

  // 1. Check for existing linked account
  const [existingAccount] = await db
    .select()
    .from(oauthAccounts)
    .where(
      and(eq(oauthAccounts.provider, provider), eq(oauthAccounts.providerUserId, providerUser.id)),
    )
    .limit(1);

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
      .where(eq(oauthAccounts.id, existingAccount.id));

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, existingAccount.userId))
      .limit(1);

    if (!user) {
      logger.error(
        `oauth_accounts row ${existingAccount.id} references missing user ${existingAccount.userId}`,
      );
      throw new Error('OAuth account references a deleted user');
    }
    return user as User;
  }

  // 2. Check for existing user by email
  // If an account with this email already exists but was not linked via OAuth,
  // either link it (when the user has given explicit consent) or reject the
  // login. Auto-linking without consent is an account takeover vector: an
  // attacker who controls a provider email instantly owns the existing account.
  let userId: string;
  let isNewUser = false;

  if (providerUser.email) {
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, providerUser.email))
      .limit(1);

    if (existingUser) {
      if (options?.linkConsent) {
        // User explicitly consented to link  -  use the existing account
        userId = existingUser.id;
        isNewUser = false;
        logger.info(`Linking ${provider} account to existing user ${userId} (consent-based)`);
      } else {
        throw new OAuthAccountConflictError(providerUser.email);
      }
    } else {
      isNewUser = true;
      userId = crypto.randomUUID();
    }
  } else {
    isNewUser = true;
    userId = crypto.randomUUID();
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
    });
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
  });

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error('Failed to fetch upserted OAuth user');
  return user as User;
}

// =============================================================================
// Explicit Account Linking
// =============================================================================

/**
 * Link an OAuth provider to an existing authenticated user.
 *
 * Unlike upsertOAuthUser(), this function requires the caller to be
 * authenticated and explicitly requests the link. This is safe because
 * the user has already proven ownership of the local account via their
 * session.
 *
 * @param userId - The authenticated user's ID (from session)
 * @param provider - OAuth provider name
 * @param providerUser - Profile returned by the OAuth provider
 * @returns The linked user
 * @throws Error if the provider account is already linked to a different user
 */
export async function linkOAuthAccount(
  userId: string,
  provider: string,
  providerUser: ProviderUser,
): Promise<User> {
  const db = getClient();

  // 1. Check if this provider identity is already linked to ANY user
  const [existingLink] = await db
    .select()
    .from(oauthAccounts)
    .where(
      and(eq(oauthAccounts.provider, provider), eq(oauthAccounts.providerUserId, providerUser.id)),
    )
    .limit(1);

  if (existingLink) {
    if (existingLink.userId === userId) {
      // Already linked to this user  -  refresh metadata and return
      await db
        .update(oauthAccounts)
        .set({
          providerEmail: providerUser.email,
          providerName: providerUser.name,
          providerAvatarUrl: providerUser.avatarUrl,
          updatedAt: new Date(),
        })
        .where(eq(oauthAccounts.id, existingLink.id));

      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user) throw new Error('Authenticated user not found in database');
      return user as User;
    }
    // Linked to a different user  -  cannot steal the identity
    throw new Error(
      'This provider account is already linked to another user. Unlink it from the other account first.',
    );
  }

  // 2. Check the authenticated user exists
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error('Authenticated user not found in database');

  // 3. Check if this user already has a link for this provider (different provider account)
  const [existingProviderLink] = await db
    .select()
    .from(oauthAccounts)
    .where(and(eq(oauthAccounts.userId, userId), eq(oauthAccounts.provider, provider)))
    .limit(1);

  if (existingProviderLink) {
    throw new Error(
      `You already have a ${provider} account linked. Unlink it first to connect a different one.`,
    );
  }

  // 4. Create the link
  await db.insert(oauthAccounts).values({
    id: crypto.randomUUID(),
    userId,
    provider,
    providerUserId: providerUser.id,
    providerEmail: providerUser.email,
    providerName: providerUser.name,
    providerAvatarUrl: providerUser.avatarUrl,
  });

  logger.info(`Linked ${provider} account to user ${userId}`);
  return user as User;
}

/**
 * Unlink an OAuth provider from a user's account.
 *
 * Safety: refuses to unlink the last auth method (if user has no password
 * and this is their only OAuth link, unlinking would lock them out).
 *
 * @param userId - The authenticated user's ID
 * @param provider - The provider to unlink
 * @throws Error if unlinking would leave the user with no authentication method
 */
export async function unlinkOAuthAccount(userId: string, provider: string): Promise<void> {
  const db = getClient();

  // 1. Find the link to remove
  const [link] = await db
    .select()
    .from(oauthAccounts)
    .where(and(eq(oauthAccounts.userId, userId), eq(oauthAccounts.provider, provider)))
    .limit(1);

  if (!link) {
    throw new Error(`No ${provider} account is linked to your account`);
  }

  // 2. Safety check: ensure user won't be locked out
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error('User not found');

  const allLinks = await db
    .select({ id: oauthAccounts.id })
    .from(oauthAccounts)
    .where(eq(oauthAccounts.userId, userId));

  const hasPassword = !!(user as User).password;
  const otherLinksCount = allLinks.length - 1;

  if (!hasPassword && otherLinksCount === 0) {
    throw new Error(
      'Cannot unlink your only sign-in method. Set a password first, or link another provider.',
    );
  }

  // 3. Delete the link
  await db
    .delete(oauthAccounts)
    .where(and(eq(oauthAccounts.userId, userId), eq(oauthAccounts.provider, provider)));

  logger.info(`Unlinked ${provider} account from user ${userId}`);
}

/**
 * Get all linked OAuth providers for a user.
 *
 * @param userId - The user's ID
 * @returns Array of linked provider info (provider name, email, avatar)
 */
export async function getLinkedProviders(
  userId: string,
): Promise<Array<{ provider: string; providerEmail: string | null; providerName: string | null }>> {
  const db = getClient();

  const links = await db
    .select({
      provider: oauthAccounts.provider,
      providerEmail: oauthAccounts.providerEmail,
      providerName: oauthAccounts.providerName,
    })
    .from(oauthAccounts)
    .where(eq(oauthAccounts.userId, userId));

  return links;
}
