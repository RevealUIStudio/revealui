/**
 * Google OAuth 2.0 Provider
 *
 * Uses native fetch — no additional npm dependencies.
 * Scopes: openid email profile
 */

import type { ProviderUser } from '../oauth.js';

export function buildAuthUrl(
  clientId: string,
  redirectUri: string,
  state: string,
  codeChallenge?: string,
): string {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  url.searchParams.set('access_type', 'online');
  if (codeChallenge) {
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
  }
  return url.toString();
}

export async function exchangeCode(
  code: string,
  redirectUri: string,
  codeVerifier?: string,
): Promise<string> {
  const params: Record<string, string> = {
    code,
    client_id: process.env.GOOGLE_CLIENT_ID ?? '',
    client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  };
  if (codeVerifier) {
    params.code_verifier = codeVerifier;
  }
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });

  if (!response.ok) {
    let detail = '';
    try {
      const err = (await response.json()) as { error_description?: string; error?: string };
      detail = err.error_description ?? err.error ?? '';
    } catch {
      // Response body not JSON — use status only
    }
    throw new Error(
      `Google token exchange failed: ${response.status}${detail ? ` — ${detail}` : ''}`,
    );
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token || typeof data.access_token !== 'string') {
    throw new Error('Google token exchange returned no access_token');
  }
  return data.access_token;
}

export async function fetchUser(accessToken: string): Promise<ProviderUser> {
  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    let detail = '';
    try {
      const err = (await response.json()) as { error?: { message?: string } };
      detail = err.error?.message ?? '';
    } catch {
      // Response body not JSON
    }
    throw new Error(
      `Google userinfo fetch failed: ${response.status}${detail ? ` — ${detail}` : ''}`,
    );
  }

  const data = (await response.json()) as {
    sub: string;
    email?: string;
    name?: string;
    picture?: string;
  };

  return {
    id: data.sub,
    email: data.email ?? null,
    name: data.name ?? 'Google User',
    avatarUrl: data.picture ?? null,
  };
}
