/**
 * Keyless Gmail access via Workload Identity Federation (GAP-211).
 *
 * Vercel injects VERCEL_OIDC_TOKEN. We exchange it at STS for a federated
 * access token, IAM Credentials signs a domain-wide-delegation JWT, then
 * OAuth2 issues a Gmail access token. No downloadable SA private key.
 */

const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
const STS_TOKEN_URL = 'https://sts.googleapis.com/v1/token';
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export interface GmailWifEnv {
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_WIF_PROVIDER?: string;
  GOOGLE_WIF_AUDIENCE?: string;
  GOOGLE_WIF_ID_TOKEN?: string;
  VERCEL_OIDC_TOKEN?: string;
  EMAIL_FROM?: string;
}

export function gmailWifConfigured(env: GmailWifEnv = process.env): boolean {
  return Boolean(env.GOOGLE_SERVICE_ACCOUNT_EMAIL && env.GOOGLE_WIF_PROVIDER);
}

function subjectToken(env: GmailWifEnv): string | undefined {
  const token = env.VERCEL_OIDC_TOKEN ?? env.GOOGLE_WIF_ID_TOKEN;
  return token && token.length > 0 ? token : undefined;
}

function audience(env: GmailWifEnv): string {
  if (env.GOOGLE_WIF_AUDIENCE && env.GOOGLE_WIF_AUDIENCE.length > 0) {
    return env.GOOGLE_WIF_AUDIENCE;
  }
  return `//iam.googleapis.com/${env.GOOGLE_WIF_PROVIDER}`;
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`HTTP ${res.status}: non-JSON body`);
  }
}

/** Exchange the runtime OIDC token for a federated GCP access token. */
export async function exchangeStsToken(env: GmailWifEnv): Promise<string> {
  const token = subjectToken(env);
  if (!token) {
    throw new Error(
      'No OIDC subject token (VERCEL_OIDC_TOKEN or GOOGLE_WIF_ID_TOKEN). Enable Vercel OIDC.',
    );
  }
  const provider = env.GOOGLE_WIF_PROVIDER;
  if (!provider) {
    throw new Error('GOOGLE_WIF_PROVIDER is not set');
  }
  const res = await fetch(STS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grantType: 'urn:ietf:params:oauth:grant-type:token-exchange',
      audience: audience(env),
      scope: 'https://www.googleapis.com/auth/iam',
      requestedTokenType: 'urn:ietf:params:oauth:token-type:access_token',
      subjectToken: token,
      subjectTokenType: 'urn:ietf:params:oauth:token-type:id_token',
    }),
  });
  const body = await readJson(res);
  const access = body.access_token;
  if (typeof access !== 'string' || access.length === 0) {
    throw new Error('STS token exchange returned no access_token');
  }
  return access;
}

/** Ask IAM Credentials to sign a domain-wide-delegation JWT for Gmail send. */
export async function signDelegatedJwt(
  federatedAccessToken: string,
  env: GmailWifEnv,
): Promise<string> {
  const sa = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  if (!sa) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL is not set');
  }
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: sa,
    sub: env.EMAIL_FROM ?? 'noreply@revealui.com',
    aud: OAUTH_TOKEN_URL,
    iat: now,
    exp: now + 3600,
    scope: GMAIL_SEND_SCOPE,
  };
  const url = `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(sa)}:signJwt`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${federatedAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ payload: JSON.stringify(payload) }),
  });
  const body = await readJson(res);
  const signed = body.signedJwt;
  if (typeof signed !== 'string' || signed.length === 0) {
    throw new Error('iamcredentials.signJwt returned no signedJwt');
  }
  return signed;
}

export async function exchangeJwtForGmailAccessToken(signedJwt: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signedJwt,
    }),
  });
  const body = await readJson(res);
  const access = body.access_token;
  if (typeof access !== 'string' || access.length === 0) {
    throw new Error('Google OAuth2 token exchange failed: no access_token');
  }
  const expiresIn =
    typeof body.expires_in === 'number' && body.expires_in > 0 ? body.expires_in : 3600;
  return { accessToken: access, expiresIn };
}

export async function mintGmailAccessToken(env: GmailWifEnv = process.env): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const federated = await exchangeStsToken(env);
  const signedJwt = await signDelegatedJwt(federated, env);
  return exchangeJwtForGmailAccessToken(signedJwt);
}
