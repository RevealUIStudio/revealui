/**
 * Vercel OAuth Provider
 *
 * Uses native fetch — no additional npm dependencies.
 * No scopes required — Vercel uses full access by default.
 */

import type { ProviderUser } from '../oauth.js';

export function buildAuthUrl(
  clientId: string,
  redirectUri: string,
  state: string,
  _codeChallenge?: string,
): string {
  const url = new URL('https://vercel.com/oauth/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  return url.toString();
}

export async function exchangeCode(
  code: string,
  redirectUri: string,
  _codeVerifier?: string,
): Promise<string> {
  const response = await fetch('https://api.vercel.com/v2/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.VERCEL_CLIENT_ID ?? '',
      client_secret: process.env.VERCEL_CLIENT_SECRET ?? '',
      redirect_uri: redirectUri,
    }),
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
      `Vercel token exchange failed: ${response.status}${detail ? ` — ${detail}` : ''}`,
    );
  }

  const data = (await response.json()) as { access_token?: string; error?: string };
  if (data.error) {
    throw new Error(`Vercel token exchange error: ${data.error}`);
  }
  if (!data.access_token || typeof data.access_token !== 'string') {
    throw new Error('Vercel token exchange returned no access_token');
  }
  return data.access_token;
}

export async function fetchUser(accessToken: string): Promise<ProviderUser> {
  const response = await fetch('https://api.vercel.com/v2/user', {
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
    throw new Error(`Vercel user fetch failed: ${response.status}${detail ? ` — ${detail}` : ''}`);
  }

  const data = (await response.json()) as {
    user: {
      id: string;
      email: string;
      name?: string | null;
      username?: string;
      avatar?: string | null;
    };
  };

  const u = data.user;
  return {
    id: u.id,
    email: u.email,
    name: u.name ?? u.username ?? 'Vercel User',
    avatarUrl: u.avatar ? `https://avatar.vercel.sh/${u.avatar}` : null,
  };
}
