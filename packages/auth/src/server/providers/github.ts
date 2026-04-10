/**
 * GitHub OAuth Provider
 *
 * Uses native fetch — no additional npm dependencies.
 * Scopes: read:user user:email
 *
 * Note: GitHub may return null email if user has set it private.
 * In that case we fetch from /user/emails and pick the primary verified one.
 */

import type { ProviderUser } from '../oauth.js';

export function buildAuthUrl(
  clientId: string,
  redirectUri: string,
  state: string,
  codeChallenge?: string,
): string {
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', 'read:user user:email');
  url.searchParams.set('state', state);
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
    client_id: process.env.GITHUB_CLIENT_ID ?? '',
    client_secret: process.env.GITHUB_CLIENT_SECRET ?? '',
    redirect_uri: redirectUri,
  };
  if (codeVerifier) {
    params.code_verifier = codeVerifier;
  }
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
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
      `GitHub token exchange failed: ${response.status}${detail ? ` — ${detail}` : ''}`,
    );
  }

  const data = (await response.json()) as { access_token?: string; error?: string };
  if (data.error) {
    throw new Error(`GitHub token exchange error: ${data.error}`);
  }
  if (!data.access_token || typeof data.access_token !== 'string') {
    throw new Error('GitHub token exchange returned no access_token');
  }
  return data.access_token;
}

export async function fetchUser(accessToken: string): Promise<ProviderUser> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/vnd.github+json',
  };

  const userResponse = await fetch('https://api.github.com/user', { headers });
  if (!userResponse.ok) {
    let detail = '';
    try {
      const err = (await userResponse.json()) as { message?: string };
      detail = err.message ?? '';
    } catch {
      // Response body not JSON
    }
    throw new Error(
      `GitHub user fetch failed: ${userResponse.status}${detail ? ` — ${detail}` : ''}`,
    );
  }

  const user = (await userResponse.json()) as {
    id: number;
    login: string;
    name?: string | null;
    email?: string | null;
    avatar_url?: string;
  };

  let email: string | null = user.email ?? null;

  // Fetch emails if not public
  if (!email) {
    const emailsResponse = await fetch('https://api.github.com/user/emails', { headers });
    if (emailsResponse.ok) {
      const emails = (await emailsResponse.json()) as Array<{
        email: string;
        primary: boolean;
        verified: boolean;
      }>;
      const primary = emails.find((e) => e.primary && e.verified);
      email = primary?.email ?? null;
    }
  }

  return {
    id: String(user.id),
    email,
    name: user.name ?? user.login,
    avatarUrl: user.avatar_url ?? null,
  };
}
