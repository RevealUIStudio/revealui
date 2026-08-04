/**
 * Enterprise SSO signed state cookie (GAP-464).
 *
 * Separate from social OAuth generateOAuthState / verifyOAuthState so enterprise
 * IdP bindings (accountId + providerId + PKCE) never overload provider enums.
 *
 * Cookie value: `<state>.<hmac-hex>` where state is base64url(JSON payload)
 * and HMAC-SHA256 is over the state string using REVEALUI_SECRET.
 */

import crypto from 'node:crypto';

export interface SsoStatePayload {
  accountId: string;
  providerId: string;
  redirectTo: string;
  nonce: string;
  codeVerifier: string;
}

export interface GenerateSsoStateInput {
  accountId: string;
  providerId: string;
  redirectTo: string;
}

export interface GenerateSsoStateResult {
  /** Opaque state query param sent to the IdP */
  state: string;
  /** Value for the httpOnly SSO state cookie (`state.hmac`) */
  cookieValue: string;
  /** S256 PKCE code_challenge for the authorization request */
  codeChallenge: string;
}

export interface VerifiedSsoState {
  accountId: string;
  providerId: string;
  redirectTo: string;
  nonce: string;
  codeVerifier: string;
}

function requireSecret(): string {
  const secret = process.env.REVEALUI_SECRET;
  if (!secret) {
    throw new Error(
      'REVEALUI_SECRET is required for SSO state signing. ' +
        'Set it in your environment variables.',
    );
  }
  return secret;
}

/**
 * Generate a signed SSO state token with PKCE verifier.
 */
export function generateSsoState(input: GenerateSsoStateInput): GenerateSsoStateResult {
  const { accountId, providerId, redirectTo } = input;
  if (!(accountId && providerId)) {
    throw new Error('accountId and providerId are required for SSO state');
  }

  const nonce = crypto.randomBytes(16).toString('hex');
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

  const payload: SsoStatePayload = {
    accountId,
    providerId,
    redirectTo,
    nonce,
    codeVerifier,
  };
  const state = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const secret = requireSecret();
  // lgtm[js/insufficient-password-hash] - HMAC-SHA256 for SSO CSRF state, not password hashing
  const hmac = crypto.createHmac('sha256', secret).update(state).digest('hex');

  return {
    state,
    cookieValue: `${state}.${hmac}`,
    codeChallenge,
  };
}

/**
 * Verify a signed SSO state token from the callback.
 * Returns null on any integrity / shape failure (does not throw for bad input).
 */
export function verifySsoState(
  state: string | null | undefined,
  cookieValue: string | null | undefined,
): VerifiedSsoState | null {
  if (!(state && cookieValue)) return null;

  const dotIdx = cookieValue.lastIndexOf('.');
  if (dotIdx === -1) return null;

  const storedState = cookieValue.substring(0, dotIdx);
  const storedHmac = cookieValue.substring(dotIdx + 1);

  if (
    storedState.length !== state.length ||
    !crypto.timingSafeEqual(Buffer.from(storedState), Buffer.from(state))
  ) {
    return null;
  }

  const secret = requireSecret();
  // lgtm[js/insufficient-password-hash] - HMAC-SHA256 for SSO CSRF state, not password hashing
  const expectedHmac = crypto.createHmac('sha256', secret).update(state).digest('hex');

  // Both are hex-encoded SHA-256 HMACs — must be exactly 64 hex characters.
  if (storedHmac.length !== 64 || expectedHmac.length !== 64) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(storedHmac, 'hex'), Buffer.from(expectedHmac, 'hex'))) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(state, 'base64url').toString(),
    ) as Partial<SsoStatePayload>;
    if (
      typeof parsed.accountId !== 'string' ||
      typeof parsed.providerId !== 'string' ||
      typeof parsed.redirectTo !== 'string' ||
      typeof parsed.nonce !== 'string' ||
      typeof parsed.codeVerifier !== 'string' ||
      !parsed.accountId ||
      !parsed.providerId ||
      !parsed.nonce ||
      !parsed.codeVerifier
    ) {
      return null;
    }
    return {
      accountId: parsed.accountId,
      providerId: parsed.providerId,
      redirectTo: parsed.redirectTo,
      nonce: parsed.nonce,
      codeVerifier: parsed.codeVerifier,
    };
  } catch {
    return null;
  }
}
