/**
 * Software-key override door (GAP-313).
 *
 * Ed25519 PKCS#8 PEM, private half encrypted with the owner passphrase
 * (aes-256-cbc) via node:crypto. No TTY and no ssh-keygen.
 *
 * The signed bytes are UTF-8 JSON of repo, pr_number, head_sha, gate_name,
 * and expires_at, keys sorted, no extra whitespace. A label is only a request:
 * overrideAllowed is true only when the label is present and verification.ok.
 */

import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  type KeyObject,
  sign,
  verify,
} from 'node:crypto';
import { chmodSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';

export const OVERRIDE_PAYLOAD_KEYS = [
  'expires_at',
  'gate_name',
  'head_sha',
  'pr_number',
  'repo',
] as const;

export const SIGNATURE_VERSION = 1;
export const SIGNATURE_ALG = 'Ed25519' as const;
export const PRIVATE_KEY_CIPHER = 'aes-256-cbc' as const;
export const PRIVATE_KEY_FILENAME = 'override-private.pem';
export const PUBLIC_KEY_FILENAME = 'override-public.pem';
export const PASSPHRASE_ENV = 'SIGNED_OVERRIDE_PASSPHRASE';

const PRIVATE_KEY_MODE = 0o600;
const PUBLIC_KEY_MODE = 0o644;
const KEY_DIR_MODE = 0o700;
const MAX_REPO_LENGTH = 200;
const MAX_GATE_NAME_LENGTH = 200;
const MIN_PR_NUMBER = 1;
const MAX_PR_NUMBER = 1_000_000_000;
const SHA_LENGTH_SHORT = 40;
const SHA_LENGTH_LONG = 64;
const ED25519_SIGNATURE_BYTES = 64;

type PayloadKey = (typeof OVERRIDE_PAYLOAD_KEYS)[number];

export interface OverridePayload {
  repo: string;
  pr_number: number;
  head_sha: string;
  gate_name: string;
  expires_at: string;
}

export interface ExpectedOverrideContext {
  repo: string;
  pr_number: number;
  head_sha: string;
  gate_name: string;
}

export interface SignatureBlob {
  v: 1;
  alg: typeof SIGNATURE_ALG;
  payload: OverridePayload;
  signature: string;
}

export type VerifyReason =
  | 'wrong-repo'
  | 'wrong-pr'
  | 'wrong-sha'
  | 'wrong-gate'
  | 'expired'
  | 'bad-signature'
  | 'invalid-payload'
  | 'bad-public-key'
  | 'bad-artifact';

export interface Verification {
  ok: boolean;
  reason?: VerifyReason;
}

export interface VerifyOverrideInput {
  blob: unknown;
  publicKeyPem: string;
  expected: ExpectedOverrideContext;
  now?: Date;
}

export interface SoftwareKeyPairPem {
  privateKeyPem: string;
  publicKeyPem: string;
}

export interface WrittenKeyPaths {
  privateKeyPath: string;
  publicKeyPath: string;
}

export type SignedOverrideErrorCode =
  | 'passphrase-required'
  | 'bad-passphrase'
  | 'bad-private-key'
  | 'invalid-payload'
  | 'key-output-inside-repo';

export class SignedOverrideError extends Error {
  readonly code: SignedOverrideErrorCode;

  constructor(code: SignedOverrideErrorCode, message: string) {
    super(message);
    this.name = 'SignedOverrideError';
    this.code = code;
  }
}

export interface OverrideAllowanceInput {
  labelPresent: boolean;
  verification: { ok: boolean };
}

/** True only when the label request and a successful verification are both present. */
export function overrideAllowed(input: OverrideAllowanceInput): boolean {
  return input.labelPresent === true && input.verification.ok === true;
}

/** Canonical UTF-8 JSON (sorted keys, no extra whitespace) that sign/verify use. */
export function canonicalOverridePayload(payload: OverridePayload): string {
  const body: Record<string, string | number> = {};
  for (const key of OVERRIDE_PAYLOAD_KEYS) {
    body[key] = payloadField(payload, key);
  }
  return JSON.stringify(body);
}

export function generateEncryptedKeypair(passphrase: string): SoftwareKeyPairPem {
  assertPassphrase(passphrase);
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const privateExported = privateKey.export({
    type: 'pkcs8',
    format: 'pem',
    cipher: PRIVATE_KEY_CIPHER,
    passphrase,
  });
  const publicExported = publicKey.export({ type: 'spki', format: 'pem' });
  const privateKeyPem = pemToString(privateExported);
  const publicKeyPem = pemToString(publicExported);
  if (!privateKeyPem.includes('BEGIN ENCRYPTED PRIVATE KEY')) {
    throw new SignedOverrideError('bad-private-key', 'private key was not encrypted');
  }
  return { privateKeyPem, publicKeyPem };
}

/** Writes the encrypted private key and the public key. Caller picks the directory. */
export function writeEncryptedKeypair(outDir: string, passphrase: string): WrittenKeyPaths {
  const pair = generateEncryptedKeypair(passphrase);
  mkdirSync(outDir, { recursive: true, mode: KEY_DIR_MODE });
  const privateKeyPath = join(outDir, PRIVATE_KEY_FILENAME);
  const publicKeyPath = join(outDir, PUBLIC_KEY_FILENAME);
  writeFileSync(privateKeyPath, pair.privateKeyPem, { mode: PRIVATE_KEY_MODE, flag: 'wx' });
  chmodSync(privateKeyPath, PRIVATE_KEY_MODE);
  try {
    writeFileSync(publicKeyPath, pair.publicKeyPem, { mode: PUBLIC_KEY_MODE, flag: 'wx' });
    chmodSync(publicKeyPath, PUBLIC_KEY_MODE);
  } catch (err) {
    rmSync(privateKeyPath, { force: true });
    throw err;
  }
  return { privateKeyPath, publicKeyPath };
}

export function signOverride(
  payload: OverridePayload,
  privateKeyPem: string,
  passphrase: string,
): SignatureBlob {
  const problem = payloadProblem(payload);
  if (problem !== null) {
    throw new SignedOverrideError('invalid-payload', problem);
  }
  const key = openEncryptedPrivateKey(privateKeyPem, passphrase);
  const canonical = canonicalOverridePayload(payload);
  const signature = sign(null, Buffer.from(canonical, 'utf8'), key).toString('base64');
  return {
    v: SIGNATURE_VERSION,
    alg: SIGNATURE_ALG,
    payload: copyPayload(payload),
    signature,
  };
}

export function verifyOverride(input: VerifyOverrideInput): Verification {
  const parsed = parseSignatureBlob(input.blob);
  if (parsed === null) {
    return { ok: false, reason: 'bad-artifact' };
  }
  if (payloadProblem(parsed.payload) !== null) {
    return { ok: false, reason: 'invalid-payload' };
  }
  if (parsed.payload.repo !== input.expected.repo) {
    return { ok: false, reason: 'wrong-repo' };
  }
  if (parsed.payload.pr_number !== input.expected.pr_number) {
    return { ok: false, reason: 'wrong-pr' };
  }
  if (parsed.payload.head_sha !== input.expected.head_sha) {
    return { ok: false, reason: 'wrong-sha' };
  }
  if (parsed.payload.gate_name !== input.expected.gate_name) {
    return { ok: false, reason: 'wrong-gate' };
  }
  const expiresMs = Date.parse(parsed.payload.expires_at);
  const nowMs = input.now === undefined ? Date.now() : input.now.getTime();
  if (expiresMs <= nowMs) {
    return { ok: false, reason: 'expired' };
  }
  const cryptoResult = checkSignature(
    canonicalOverridePayload(parsed.payload),
    parsed.signature,
    input.publicKeyPem,
  );
  if (cryptoResult !== 'ok') {
    return { ok: false, reason: cryptoResult };
  }
  return { ok: true };
}

export function serializeArtifact(blob: SignatureBlob): string {
  return `${JSON.stringify(blob, null, 2)}\n`;
}

export function parseArtifactText(text: string): unknown {
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed;
  } catch {
    return null;
  }
}

/** True when candidate is parent itself or a path under parent. */
export function isPathInside(parent: string, candidate: string): boolean {
  const root = resolve(parent);
  const target = resolve(candidate);
  if (target === root) return true;
  const prefix = root.endsWith(sep) ? root : `${root}${sep}`;
  return target.startsWith(prefix);
}

function copyPayload(payload: OverridePayload): OverridePayload {
  return {
    expires_at: payload.expires_at,
    gate_name: payload.gate_name,
    head_sha: payload.head_sha,
    pr_number: payload.pr_number,
    repo: payload.repo,
  };
}

function payloadField(payload: OverridePayload, key: PayloadKey): string | number {
  switch (key) {
    case 'expires_at':
      return payload.expires_at;
    case 'gate_name':
      return payload.gate_name;
    case 'head_sha':
      return payload.head_sha;
    case 'pr_number':
      return payload.pr_number;
    case 'repo':
      return payload.repo;
    default: {
      const neverKey: never = key;
      return neverKey;
    }
  }
}

function payloadProblem(payload: OverridePayload): string | null {
  if (!isRepoName(payload.repo)) return 'repo must be owner/name';
  if (!isPrNumber(payload.pr_number)) return 'pr_number must be a positive integer';
  const shortSha = isLowerHex(payload.head_sha, SHA_LENGTH_SHORT);
  const longSha = isLowerHex(payload.head_sha, SHA_LENGTH_LONG);
  if (!(shortSha || longSha)) {
    return 'head_sha must be 40 or 64 lowercase hex characters';
  }
  if (!isGateName(payload.gate_name)) return 'gate_name must be a non-empty name';
  if (!isIsoTimestamp(payload.expires_at)) return 'expires_at must be an ISO-8601 timestamp';
  return null;
}

function isRepoName(value: string): boolean {
  if (value.length < 3 || value.length > MAX_REPO_LENGTH) return false;
  const slash = value.indexOf('/');
  if (slash <= 0 || slash !== value.lastIndexOf('/') || slash === value.length - 1) return false;
  return isRepoSegment(value.slice(0, slash)) && isRepoSegment(value.slice(slash + 1));
}

function isRepoSegment(value: string): boolean {
  if (value.length === 0) return false;
  for (const ch of value) {
    const ok =
      (ch >= 'A' && ch <= 'Z') ||
      (ch >= 'a' && ch <= 'z') ||
      (ch >= '0' && ch <= '9') ||
      ch === '.' ||
      ch === '_' ||
      ch === '-';
    if (!ok) return false;
  }
  return true;
}

function isPrNumber(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_PR_NUMBER && value <= MAX_PR_NUMBER;
}

function isLowerHex(value: string, length: number): boolean {
  if (value.length !== length) return false;
  for (const ch of value) {
    const isDigit = ch >= '0' && ch <= '9';
    const isHex = ch >= 'a' && ch <= 'f';
    if (!(isDigit || isHex)) return false;
  }
  return true;
}

function isGateName(value: string): boolean {
  if (value.length < 1 || value.length > MAX_GATE_NAME_LENGTH) return false;
  for (const ch of value) {
    const code = ch.codePointAt(0);
    if (code === undefined || code < 32 || code === 127) return false;
  }
  return true;
}

function isIsoTimestamp(value: string): boolean {
  if (value.length < 20 || value.length > 40) return false;
  return Number.isFinite(Date.parse(value));
}

function assertPassphrase(passphrase: string): void {
  if (passphrase.length === 0) {
    throw new SignedOverrideError('passphrase-required', 'passphrase must be non-empty');
  }
}

function openEncryptedPrivateKey(privateKeyPem: string, passphrase: string): KeyObject {
  assertPassphrase(passphrase);
  try {
    const key = createPrivateKey({ key: privateKeyPem, format: 'pem', passphrase });
    if (key.asymmetricKeyType !== 'ed25519') {
      throw new SignedOverrideError('bad-private-key', 'private key must be Ed25519');
    }
    return key;
  } catch (err) {
    if (err instanceof SignedOverrideError) throw err;
    if (isBadDecrypt(err)) {
      throw new SignedOverrideError('bad-passphrase', 'could not decrypt private key');
    }
    throw new SignedOverrideError('bad-private-key', 'could not read private key');
  }
}

function isBadDecrypt(err: unknown): boolean {
  if (errorCode(err) === 'ERR_OSSL_BAD_DECRYPT') return true;
  if (err instanceof Error) {
    return err.message.toLowerCase().includes('bad decrypt');
  }
  return false;
}

function errorCode(err: unknown): string {
  if (!(isRecord(err) && 'code' in err)) return '';
  const code = err.code;
  return typeof code === 'string' ? code : '';
}

function checkSignature(
  canonical: string,
  signatureB64: string,
  publicKeyPem: string,
): 'ok' | 'bad-signature' | 'bad-public-key' {
  let publicKey: KeyObject;
  try {
    publicKey = createPublicKey(publicKeyPem);
  } catch {
    return 'bad-public-key';
  }
  if (publicKey.asymmetricKeyType !== 'ed25519') {
    return 'bad-public-key';
  }
  const sig = decodeSignature(signatureB64);
  if (sig === null || sig.length !== ED25519_SIGNATURE_BYTES) {
    return 'bad-signature';
  }
  try {
    const ok = verify(null, Buffer.from(canonical, 'utf8'), publicKey, sig);
    return ok ? 'ok' : 'bad-signature';
  } catch {
    return 'bad-signature';
  }
}

function decodeSignature(signature: string): Buffer | null {
  if (signature.length === 0 || signature.length % 4 === 1) return null;
  for (const ch of signature) {
    const ok =
      (ch >= 'A' && ch <= 'Z') ||
      (ch >= 'a' && ch <= 'z') ||
      (ch >= '0' && ch <= '9') ||
      ch === '+' ||
      ch === '/' ||
      ch === '=';
    if (!ok) return null;
  }
  const buf = Buffer.from(signature, 'base64');
  if (buf.toString('base64') !== signature) return null;
  return buf;
}

function parseSignatureBlob(value: unknown): SignatureBlob | null {
  if (!isRecord(value)) return null;
  const keys = Object.keys(value);
  if (keys.length !== 4) return null;
  for (const key of keys) {
    if (key !== 'v' && key !== 'alg' && key !== 'payload' && key !== 'signature') return null;
  }
  if (value.v !== SIGNATURE_VERSION || value.alg !== SIGNATURE_ALG) return null;
  if (typeof value.signature !== 'string') return null;
  const payload = readPayloadShape(value.payload);
  if (payload === null) return null;
  return { v: SIGNATURE_VERSION, alg: SIGNATURE_ALG, payload, signature: value.signature };
}

function readPayloadShape(value: unknown): OverridePayload | null {
  if (!isRecord(value)) return null;
  const keys = Object.keys(value);
  if (keys.length !== OVERRIDE_PAYLOAD_KEYS.length) return null;
  for (const key of keys) {
    if (!isPayloadKey(key)) return null;
  }
  const repo = value.repo;
  const pr = value.pr_number;
  const sha = value.head_sha;
  const gate = value.gate_name;
  const expires = value.expires_at;
  if (typeof repo !== 'string') return null;
  if (typeof pr !== 'number') return null;
  if (typeof sha !== 'string') return null;
  if (typeof gate !== 'string') return null;
  if (typeof expires !== 'string') return null;
  return {
    expires_at: expires,
    gate_name: gate,
    head_sha: sha,
    pr_number: pr,
    repo,
  };
}

function isPayloadKey(key: string): boolean {
  for (const known of OVERRIDE_PAYLOAD_KEYS) {
    if (known === key) return true;
  }
  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function pemToString(exported: string | Buffer): string {
  if (typeof exported === 'string') return exported;
  return exported.toString('utf8');
}
