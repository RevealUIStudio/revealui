/**
 * Model/data artifact C-SCRM door (GAP-484).
 *
 * NIST C-SCRM + AI 100-2 (Vassilev, SSCA 2024): hash + URL provenance, refuse
 * pickle-class deserialize-to-ACE formats. Do not scan weights for behavior.
 *
 * This is the only supported fetch path for fleet-fetched weight artifacts.
 * Inference Snaps stay on the US-origin snap allowlist (us-origin-snaps.ts).
 * Snap store / Ollama registry names are not weight files.
 */

import { createHash } from 'node:crypto';
import { assertUsOriginInferenceSnap } from './providers/us-origin-snaps.js';

/** Formats that deserialize to arbitrary code (pickle protocol family). */
export const ACE_MODEL_SUFFIXES = [
  '.pickle',
  '.pkl',
  '.joblib',
  '.dill',
  '.pth',
  '.pt',
  '.ckpt',
  '.bin',
] as const;

/** Formats that do not use pickle deserialize. */
export const SAFE_MODEL_SUFFIXES = ['.safetensors', '.gguf', '.onnx'] as const;

export class AceModelArtifactError extends Error {
  readonly code = 'ACE_MODEL_ARTIFACT' as const;
  readonly filename: string;

  constructor(filename: string) {
    super(
      `Refusing model artifact "${filename}": pickle-class formats can deserialize ` +
        'to arbitrary code (NIST AI 100-2 / GAP-484). Use .safetensors, .gguf, or .onnx. ' +
        'We do not scan weights for behavior.',
    );
    this.name = 'AceModelArtifactError';
    this.filename = filename;
  }
}

export class ArtifactProvenanceError extends Error {
  readonly code = 'ARTIFACT_PROVENANCE' as const;

  constructor(message: string) {
    super(message);
    this.name = 'ArtifactProvenanceError';
  }
}

export class ArtifactHashMismatchError extends Error {
  readonly code = 'ARTIFACT_HASH_MISMATCH' as const;
  readonly expected: string;
  readonly actual: string;

  constructor(expected: string, actual: string) {
    super(
      `Artifact sha256 mismatch (GAP-484). expected=${expected} actual=${actual}. ` +
        'This is an integrity check, not a capability scan of the weights.',
    );
    this.name = 'ArtifactHashMismatchError';
    this.expected = expected;
    this.actual = actual;
  }
}

export interface ArtifactProvenance {
  readonly url: string;
  readonly sha256: string;
  readonly filename: string;
}

function lastPathSegment(value: string): string {
  const trimmed = value.trim();
  const slash = trimmed.lastIndexOf('/');
  const raw = slash === -1 ? trimmed : trimmed.slice(slash + 1);
  const query = raw.indexOf('?');
  return query === -1 ? raw : raw.slice(0, query);
}

function lowerName(value: string): string {
  return lastPathSegment(value).toLowerCase();
}

function hasSuffix(name: string, suffix: string): boolean {
  return name.length > suffix.length && name.endsWith(suffix);
}

/** True when the path looks like a pickle-class deserialize format. */
export function isAceDeserializeArtifact(name: string): boolean {
  const n = lowerName(name);
  return ACE_MODEL_SUFFIXES.some((suffix) => hasSuffix(n, suffix));
}

/** True when the path is an allowlisted non-pickle weight format. */
export function isSafeModelArtifactName(name: string): boolean {
  const n = lowerName(name);
  if (n.length === 0) return false;
  return SAFE_MODEL_SUFFIXES.some((suffix) => hasSuffix(n, suffix));
}

/**
 * Refuse pickle-class filenames. Allow only safetensors / gguf / onnx.
 */
export function assertSafeModelArtifactName(name: string): string {
  const filename = lastPathSegment(name);
  if (filename.length === 0) {
    throw new AceModelArtifactError(name);
  }
  if (isAceDeserializeArtifact(filename) || !isSafeModelArtifactName(filename)) {
    throw new AceModelArtifactError(filename);
  }
  return filename;
}

function isSha256Hex(value: string): boolean {
  if (value.length !== 64) return false;
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    const isDigit = c >= 48 && c <= 57;
    const isAf = c >= 97 && c <= 102;
    const isAF = c >= 65 && c <= 70;
    if (!(isDigit || isAf || isAF)) return false;
  }
  return true;
}

function isAllowedProvenanceUrl(url: URL): boolean {
  if (url.protocol === 'https:') return true;
  if (url.protocol !== 'http:') return false;
  const host = url.hostname.toLowerCase();
  return host === 'localhost' || host === '127.0.0.1';
}

/**
 * Validate URL + sha256 + safe filename. Does not fetch and does not scan weights.
 */
export function assertArtifactProvenance(spec: {
  readonly url: string;
  readonly sha256: string;
  readonly filename?: string;
}): ArtifactProvenance {
  let parsed: URL;
  try {
    parsed = new URL(spec.url);
  } catch {
    throw new ArtifactProvenanceError(`Invalid artifact URL: ${spec.url}`);
  }
  if (!isAllowedProvenanceUrl(parsed)) {
    throw new ArtifactProvenanceError(
      `Artifact URL must be https (or http localhost for operator/dev): ${spec.url}`,
    );
  }
  if (!isSha256Hex(spec.sha256)) {
    throw new ArtifactProvenanceError('Artifact sha256 must be 64 hex characters (GAP-484).');
  }
  const filename = assertSafeModelArtifactName(spec.filename ?? lastPathSegment(parsed.pathname));
  return {
    url: parsed.href,
    sha256: spec.sha256.toLowerCase(),
    filename,
  };
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Integrity check only. Not a capability or safety scan of the weights. */
export function verifyBytesSha256(bytes: Uint8Array, expectedHex: string): void {
  if (!isSha256Hex(expectedHex)) {
    throw new ArtifactProvenanceError('Artifact sha256 must be 64 hex characters (GAP-484).');
  }
  const actual = sha256Hex(bytes);
  const expected = expectedHex.toLowerCase();
  if (actual !== expected) {
    throw new ArtifactHashMismatchError(expected, actual);
  }
}

export interface FetchProvenancedArtifactOptions {
  readonly fetch?: typeof fetch;
}

/**
 * The fleet fetch door for weight artifacts: URL + sha256, then hash-verify.
 * Fails closed on ACE formats, bad URLs, missing hash, or mismatch.
 */
export async function fetchProvenancedArtifact(
  spec: {
    readonly url: string;
    readonly sha256: string;
    readonly filename?: string;
  },
  options?: FetchProvenancedArtifactOptions,
): Promise<Uint8Array> {
  const provenanced = assertArtifactProvenance(spec);
  const fetchImpl = options?.fetch ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new ArtifactProvenanceError('fetch is not available');
  }
  const response = await fetchImpl(provenanced.url);
  if (!response.ok) {
    throw new ArtifactProvenanceError(
      `Artifact fetch failed: ${response.status} ${response.statusText}`,
    );
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  verifyBytesSha256(bytes, provenanced.sha256);
  return bytes;
}

/**
 * Ollama pull refs are registry names (`gemma3:latest`), not files.
 * Refuse refs that look like local pickle/ACE paths.
 */
export function assertOllamaPullRef(modelName: string): string {
  const name = modelName.trim();
  if (name.length === 0) {
    throw new ArtifactProvenanceError('Ollama pull ref is empty');
  }
  if (isAceDeserializeArtifact(name) || isSafeModelArtifactName(name)) {
    throw new ArtifactProvenanceError(
      `Ollama pull ref "${name}" looks like a weight file. Pull a registry name, ` +
        'not a pickle or local artifact path (GAP-484).',
    );
  }
  return name;
}

/** Snap install names stay on the US-origin product allowlist. */
export function assertSnapInstallName(snapName: string): string {
  return assertUsOriginInferenceSnap(snapName);
}
