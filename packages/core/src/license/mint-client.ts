/**
 * License mint client (GAP-260 P4-3).
 *
 * Single entry for online mint surfaces (Stripe webhooks, admin generate).
 * Routes to either:
 *   - remote `apps/license-signer` POST /internal/mint when
 *     REVEALUI_LICENSE_SIGN_VIA_SIGNER is truthy, or
 *   - local {@link generateLicenseKey} with REVEALUI_LICENSE_PRIVATE_KEY
 *     (default / fallback until P4-4 drops the private key from api).
 *
 * Offline stamper (revforge) keeps calling generateLicenseKey directly.
 *
 * Env (remote path):
 *   REVEALUI_LICENSE_SIGN_VIA_SIGNER=1|true|yes|on
 *   REVEALUI_LICENSE_SIGNER_URL      base URL (e.g. http://127.0.0.1:8791)
 *   REVEALUI_SIGNER_INVOKE_SECRET    HMAC secret (no REVEALUI_SECRET fallback)
 *
 * Env (local path):
 *   REVEALUI_LICENSE_PRIVATE_KEY     PKCS#8 Ed25519 PEM (required)
 *   REVEALUI_LICENSE_PUBLIC_KEY      optional; enables kid on JWT header
 */

import { createHmac } from 'node:crypto';
import { perpetualMaxSitesForTier } from '@revealui/contracts';
import { generateLicenseKey, readPemEnv } from '../license.js';

export const SIGNER_TIMESTAMP_HEADER = 'x-revealui-signer-timestamp';
export const SIGNER_SIGNATURE_HEADER = 'x-revealui-signer-signature';
export const SIGNER_MINT_PATH = '/internal/mint';

export type MintEnv = Record<string, string | undefined>;

/** Payload fields the signer / generateLicenseKey accept for online mints. */
export type MintLicensePayload = {
  tier: 'pro' | 'max' | 'enterprise';
  customerId: string;
  domains?: string[];
  maxSites?: number;
  maxUsers?: number;
  perpetual?: boolean;
  jti?: string;
  /**
   * Relative JWT lifetime in seconds.
   * - `undefined`: local default (subscription TTL) / omit on remote body
   * - `null`: perpetual (no exp claim)
   * - number: explicit TTL
   */
  expiresInSeconds?: number | null;
};

export class LicenseMintConfigError extends Error {
  readonly code = 'license_mint_config' as const;
  constructor(message: string) {
    super(message);
    this.name = 'LicenseMintConfigError';
  }
}

export class LicenseMintRemoteError extends Error {
  readonly code = 'license_mint_remote' as const;
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'LicenseMintRemoteError';
    this.status = status;
  }
}

/** Truthy flag values for REVEALUI_LICENSE_SIGN_VIA_SIGNER. */
export function isSignViaSigner(env: MintEnv = process.env): boolean {
  const raw = (env.REVEALUI_LICENSE_SIGN_VIA_SIGNER ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

/**
 * Whether this process can mint a license key (local private key OR remote
 * signer fully configured). Used by call sites that used to gate only on
 * REVEALUI_LICENSE_PRIVATE_KEY presence.
 */
export function canMintLicense(env: MintEnv = process.env): boolean {
  if (isSignViaSigner(env)) {
    const url = env.REVEALUI_LICENSE_SIGNER_URL?.trim() ?? '';
    const secret = env.REVEALUI_SIGNER_INVOKE_SECRET?.trim() ?? '';
    return url.length > 0 && secret.length > 0;
  }
  return Boolean(env.REVEALUI_LICENSE_PRIVATE_KEY?.trim());
}

/** Human-readable reason mint is unavailable (for CRITICAL logs). */
export function mintConfigMissingMessage(env: MintEnv = process.env): string {
  if (isSignViaSigner(env)) {
    return (
      'REVEALUI_LICENSE_SIGN_VIA_SIGNER is set but REVEALUI_LICENSE_SIGNER_URL ' +
      'and/or REVEALUI_SIGNER_INVOKE_SECRET are missing'
    );
  }
  return 'REVEALUI_LICENSE_PRIVATE_KEY not configured';
}

export function signMintRequest(
  secret: string,
  method: string,
  path: string,
  body: string,
  timestampSeconds: number,
): string {
  const payload = `${timestampSeconds}.${method.toUpperCase()}.${path}.${body}`;
  return createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

/**
 * GAP-448: perpetual Agency (tier max) must bake maxSites 10 on the JWT.
 * Callers may still pass maxSites explicitly (wins). Subscription mints leave
 * maxSites unset so runtime TIER_LIMITS apply.
 */
export function withPerpetualSiteCaps(input: MintLicensePayload): MintLicensePayload {
  if (!input.perpetual || input.maxSites !== undefined) {
    return input;
  }
  const maxSites = perpetualMaxSitesForTier(input.tier);
  if (maxSites === null) {
    return input;
  }
  return { ...input, maxSites };
}

function buildMintBody(input: MintLicensePayload): Record<string, unknown> {
  const normalized = withPerpetualSiteCaps(input);
  const body: Record<string, unknown> = {
    tier: normalized.tier,
    customerId: normalized.customerId,
  };
  if (normalized.domains !== undefined) body.domains = normalized.domains;
  if (normalized.maxSites !== undefined) body.maxSites = normalized.maxSites;
  if (normalized.maxUsers !== undefined) body.maxUsers = normalized.maxUsers;
  if (normalized.perpetual !== undefined) body.perpetual = normalized.perpetual;
  if (normalized.jti !== undefined) body.jti = normalized.jti;
  if (normalized.expiresInSeconds !== undefined) {
    body.expiresInSeconds = normalized.expiresInSeconds;
  }
  return body;
}

/** Strip trailing `/` without regex (CodeQL js/polynomial-redos + fleet no-regex). */
function stripTrailingSlashes(s: string): string {
  let end = s.length;
  while (end > 0 && s.charCodeAt(end - 1) === 47 /* / */) {
    end -= 1;
  }
  return end === s.length ? s : s.slice(0, end);
}

function joinSignerUrl(base: string, path: string): string {
  return `${stripTrailingSlashes(base)}${path}`;
}

async function mintViaSigner(
  input: MintLicensePayload,
  env: MintEnv,
  fetchImpl: typeof fetch,
): Promise<string> {
  const baseUrl = env.REVEALUI_LICENSE_SIGNER_URL?.trim() ?? '';
  const secret = env.REVEALUI_SIGNER_INVOKE_SECRET?.trim() ?? '';
  if (!(baseUrl && secret)) {
    throw new LicenseMintConfigError(mintConfigMissingMessage(env));
  }

  const bodyObj = buildMintBody(input);
  const bodyText = JSON.stringify(bodyObj);
  const ts = Math.floor(Date.now() / 1000);
  const signature = signMintRequest(secret, 'POST', SIGNER_MINT_PATH, bodyText, ts);
  const url = joinSignerUrl(baseUrl, SIGNER_MINT_PATH);

  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [SIGNER_TIMESTAMP_HEADER]: String(ts),
        [SIGNER_SIGNATURE_HEADER]: signature,
      },
      body: bodyText,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new LicenseMintRemoteError(`license-signer fetch failed: ${detail}`, 0);
  }

  const text = await res.text();
  if (!res.ok) {
    throw new LicenseMintRemoteError(
      `license-signer mint failed: HTTP ${res.status}: ${text.slice(0, 200)}`,
      res.status,
    );
  }

  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new LicenseMintRemoteError('license-signer returned non-JSON body', res.status);
  }
  const licenseKey =
    typeof json === 'object' &&
    json !== null &&
    'licenseKey' in json &&
    typeof (json as { licenseKey: unknown }).licenseKey === 'string'
      ? (json as { licenseKey: string }).licenseKey
      : '';
  if (!licenseKey) {
    throw new LicenseMintRemoteError('license-signer response missing licenseKey', res.status);
  }
  return licenseKey;
}

async function mintLocal(input: MintLicensePayload, env: MintEnv): Promise<string> {
  const privateKey = readPemEnv('REVEALUI_LICENSE_PRIVATE_KEY', env);
  if (!privateKey) {
    throw new LicenseMintConfigError(mintConfigMissingMessage(env));
  }
  const publicKey = readPemEnv('REVEALUI_LICENSE_PUBLIC_KEY', env);

  const { expiresInSeconds, ...payload } = input;
  if (expiresInSeconds === undefined) {
    return generateLicenseKey(payload, privateKey, undefined, publicKey);
  }
  return generateLicenseKey(payload, privateKey, expiresInSeconds, publicKey);
}

export type MintLicenseKeyOptions = {
  env?: MintEnv;
  /** Inject for tests; defaults to global fetch. */
  fetch?: typeof fetch;
};

/**
 * Mint a signed license JWT — remote signer when flagged, else local private key.
 */
export async function mintLicenseKey(
  input: MintLicensePayload,
  options: MintLicenseKeyOptions = {},
): Promise<string> {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
  const normalized = withPerpetualSiteCaps(input);

  if (isSignViaSigner(env)) {
    return mintViaSigner(normalized, env, fetchImpl);
  }
  return mintLocal(normalized, env);
}
