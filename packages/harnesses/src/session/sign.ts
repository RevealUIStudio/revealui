/**
 * Ed25519 RPC envelope signing for daemon mutations (session.end).
 * Wire format matches RevDev hook/rpc-sign + daemon agent-identity-crypto.
 */

import { createHash, randomBytes, sign as cryptoSign } from 'node:crypto';

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function base58Encode(bytes: Uint8Array): string {
  if (!bytes || bytes.length === 0) return '';
  let leadingZeros = 0;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0) leadingZeros++;
    else break;
  }
  let value = 0n;
  for (let i = 0; i < bytes.length; i++) {
    value = value * 256n + BigInt(bytes[i]!);
  }
  let result = '';
  while (value > 0n) {
    const remainder = value % 58n;
    value = value / 58n;
    result = BASE58_ALPHABET[Number(remainder)]! + result;
  }
  return '1'.repeat(leadingZeros) + result;
}

export function canonicalizeJSON(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeJSON(item)).join(',')}]`;
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const pairs = keys.map(
    (k) => `${JSON.stringify(k)}:${canonicalizeJSON((value as Record<string, unknown>)[k])}`,
  );
  return `{${pairs.join(',')}}`;
}

export function hashParams(method: string, params: Record<string, unknown>): string {
  const digest = createHash('sha256')
    .update(`${method}:${canonicalizeJSON(params)}`)
    .digest();
  return base58Encode(new Uint8Array(digest));
}

export interface SignIdentity {
  readonly did: string;
  readonly fingerprint: string;
  readonly privateKeyPem: string;
}

/** Build `x-revdev-signature` envelope string. */
export function signRpc(
  identity: SignIdentity,
  method: string,
  params: Record<string, unknown>,
): string {
  const header = { alg: 'EdDSA', typ: 'jws' };
  const payload = {
    did: identity.did,
    kid: identity.fingerprint,
    nonce: randomBytes(16).toString('hex'),
    ts: Math.floor(Date.now() / 1000),
    method,
    paramsHash: hashParams(method, params),
  };
  const rawHeaderB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const rawPayloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const message = `${rawHeaderB64}.${rawPayloadB64}`;
  const signatureBytes = cryptoSign(null, Buffer.from(message), identity.privateKeyPem);
  const signature = Buffer.from(signatureBytes).toString('base64url');
  return `${rawHeaderB64}.${rawPayloadB64}.${signature}`;
}
