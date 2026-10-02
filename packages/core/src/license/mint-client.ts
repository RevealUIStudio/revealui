/**
 * License mint client (GAP-260 P4-3 + residual hosted gate).
 *
 * Single entry for online mint surfaces (Stripe webhooks, admin generate).
 * Routes to either:
 *   - remote `apps/license-signer` POST /internal/mint when
 *     REVEALUI_LICENSE_SIGN_VIA_SIGNER is truthy, or when
 *     REVEALUI_DEPLOYMENT_MODE=hosted (explicit; never local private-key mint), or
 *   - local {@link generateLicenseKey} with REVEALUI_LICENSE_PRIVATE_KEY
 *     only when MODE is not hosted and SIGN_VIA is off (tests / dogfood).
 *
 * Offline stamper (revforge) keeps calling generateLicenseKey directly.
 *
 * Env (remote path):
 *   REVEALUI_LICENSE_SIGN_VIA_SIGNER=1|true|yes|on
 *   REVEALUI_LICENSE_SIGNER_URL      base URL (e.g. http://127.0.0.1:8791)
 *   REVEALUI_SIGNER_INVOKE_SECRET    HMAC secret (no REVEALUI_SECRET fallback)
 *   REVEALUI_DEPLOYMENT_MODE=hosted  forces remote-only (SIGN_VIA required)
 *
 * Env (local path):
 *   REVEALUI_LICENSE_PRIVATE_KEY     PKCS#8 Ed25519 PEM (required)
 *   REVEALUI_LICENSE_PUBLIC_KEY      optional; enables kid on JWT header
 */

import { createHmac } from 'node:crypto';
import { perpetualMaxSitesForTier } from '@revealui/contracts';
import { generateLicenseKey, readPemEnv, validateLicenseKey } from '../license.js';

export const SIGNER_TIMESTAMP_HEADER = 'x-revealui-signer-timestamp';
export const SIGNER_SIGNATURE_HEADER = 'x-revealui-signer-signature';
export const SIGNER_MINT_PATH = '/internal/mint';
const SIGNER_REQUEST_TIMEOUT_MS = 5_000;
const MAX_SIGNER_RESPONSE_BYTES = 64 * 1024;

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
 * Explicit hosted SaaS posture only. Does not use private-key inference
 * (that belongs to detectDeploymentMode). Hosted online mint must never
 * fall through to mintLocal.
 */
export function isExplicitHostedMintMode(env: MintEnv = process.env): boolean {
  return (env.REVEALUI_DEPLOYMENT_MODE ?? '').trim().toLowerCase() === 'hosted';
}

function hasRemoteMintConfig(env: MintEnv): boolean {
  const url = env.REVEALUI_LICENSE_SIGNER_URL?.trim() ?? '';
  const secret = env.REVEALUI_SIGNER_INVOKE_SECRET?.trim() ?? '';
  return url.length > 0 && secret.length > 0;
}

/**
 * Whether this process can mint a license key (local private key OR remote
 * signer fully configured). Used by call sites that used to gate only on
 * REVEALUI_LICENSE_PRIVATE_KEY presence.
 *
 * Explicit MODE=hosted never treats a local private key as sufficient.
 */
export function canMintLicense(env: MintEnv = process.env): boolean {
  if (isExplicitHostedMintMode(env)) {
    return isSignViaSigner(env) && hasRemoteMintConfig(env);
  }
  if (isSignViaSigner(env)) {
    return hasRemoteMintConfig(env);
  }
  return Boolean(env.REVEALUI_LICENSE_PRIVATE_KEY?.trim());
}

/** Human-readable reason mint is unavailable (for CRITICAL logs). */
export function mintConfigMissingMessage(env: MintEnv = process.env): string {
  if (isExplicitHostedMintMode(env) && !isSignViaSigner(env)) {
    return (
      'REVEALUI_DEPLOYMENT_MODE=hosted requires REVEALUI_LICENSE_SIGN_VIA_SIGNER ' +
      'with REVEALUI_LICENSE_SIGNER_URL and REVEALUI_SIGNER_INVOKE_SECRET ' +
      '(local private-key mint is disabled on hosted)'
    );
  }
  if (isSignViaSigner(env) || isExplicitHostedMintMode(env)) {
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

function rejectOnAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const onAbort = () =>
      reject(signal.reason ?? new Error('license-signer request deadline exceeded'));
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) onAbort();
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
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

  let res: Response | undefined;
  let text: string;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SIGNER_REQUEST_TIMEOUT_MS);
  try {
    res = await rejectOnAbort(
      fetchImpl(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [SIGNER_TIMESTAMP_HEADER]: String(ts),
          [SIGNER_SIGNATURE_HEADER]: signature,
        },
        body: bodyText,
        signal: controller.signal,
      }),
      controller.signal,
    );
    text = await readBoundedResponseText(res, controller);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    const phase = res ? 'response' : 'fetch';
    throw new LicenseMintRemoteError(`license-signer ${phase} failed: ${detail}`, res?.status ?? 0);
  } finally {
    clearTimeout(timeout);
  }
  if (!res) throw new LicenseMintRemoteError('license-signer returned no response', 0);
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

async function readBoundedResponseText(
  res: Response,
  controller: AbortController,
): Promise<string> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let completed = false;
  const reading = (async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_SIGNER_RESPONSE_BYTES) {
        controller.abort(new Error('response exceeds size limit'));
        void reader.cancel().catch(() => undefined);
        throw new Error('response exceeds size limit');
      }
      chunks.push(value);
    }
    completed = true;
  })();
  try {
    await rejectOnAbort(reading, controller.signal);
  } catch (err) {
    // Do not wait for a broken stream's cancellation promise: the abort race
    // must bound startup even when an injected transport ignores the signal.
    void reader.cancel().catch(() => undefined);
    throw err;
  } finally {
    if (completed) reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function mintLocal(input: MintLicensePayload, env: MintEnv): Promise<string> {
  const privateKey = readPemEnv('REVEALUI_LICENSE_PRIVATE_KEY', env);
  if (!privateKey) {
    throw new LicenseMintConfigError(mintConfigMissingMessage(env));
  }
  const publicKeys = [
    readPemEnv('REVEALUI_LICENSE_PUBLIC_KEY', env),
    readPemEnv('REVEALUI_LICENSE_PUBLIC_KEY_NEXT', env),
  ].filter((key): key is string => Boolean(key));

  const { expiresInSeconds, ...payload } = input;
  if (publicKeys.length === 0) {
    return generateLicenseKey(payload, privateKey, expiresInSeconds, undefined);
  }
  for (const publicKey of publicKeys) {
    const token = await generateLicenseKey(payload, privateKey, expiresInSeconds, publicKey);
    if (await validateLicenseKey(token, publicKey)) return token;
  }
  throw new LicenseMintConfigError(
    'REVEALUI_LICENSE_PRIVATE_KEY does not match REVEALUI_LICENSE_PUBLIC_KEY or _NEXT',
  );
}

export type MintLicenseKeyOptions = {
  env?: MintEnv;
  /** Inject for tests; defaults to global fetch. */
  fetch?: typeof fetch;
};

/**
 * Mint a signed license JWT — remote signer when SIGN_VIA is on or MODE is
 * explicitly hosted; else local private key (tests / dogfood only).
 */
export async function mintLicenseKey(
  input: MintLicensePayload,
  options: MintLicenseKeyOptions = {},
): Promise<string> {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
  const normalized = withPerpetualSiteCaps(input);

  // Hosted online mint never uses the local private-key path, even when the
  // key is still present in env during migration.
  if (isExplicitHostedMintMode(env) && !isSignViaSigner(env)) {
    throw new LicenseMintConfigError(mintConfigMissingMessage(env));
  }
  if (isSignViaSigner(env) || isExplicitHostedMintMode(env)) {
    return mintViaSigner(normalized, env, fetchImpl);
  }
  return mintLocal(normalized, env);
}
