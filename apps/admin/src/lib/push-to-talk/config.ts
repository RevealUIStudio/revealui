/**
 * Studio dogfood push-to-talk — localhost / native sidecar (laptop + future Tauri).
 * Hosted .com cannot read disk. WASM is explicit opt-in, not the default.
 * Not a public SKU.
 */

import { isSameOriginWhisperPath } from './policy';

export type WhisperEngine = 'auto' | 'wasm' | 'sidecar';
export type ResolvedWhisperEngine = 'wasm' | 'sidecar';

export interface PushToTalkConfig {
  /**
   * Default is sidecar. `auto` also resolves to sidecar.
   * `wasm` is explicit opt-in only (phone follow-on / offline experiments).
   */
  engine: WhisperEngine;
  /** Documented sidecar transcribe URL. Empty falls back to loopback `/transcribe`. */
  whisperUrl: string;
  /** Documented sidecar files URL. Empty is derived from the transcribe origin. */
  filesUrl: string;
  /** How long to wait for sidecar / first WASM load. */
  timeoutMs: number;
  /** Reject oversized MediaRecorder blobs. */
  maxAudioBytes: number;
  /** Reject oversized attach-via-sidecar uploads. */
  maxFileBytes: number;
  /** Sidecar model class (YouTube pipeline family: `small`). */
  model: string;
  /** transformers.js / Xenova checkpoint for optional on-device WASM. */
  wasmModel: string;
  /** Preferred MediaRecorder MIME type before Safari fallbacks. */
  mimeType: string;
}

export const DEFAULT_WHISPER_ORIGIN = 'http://127.0.0.1:8178';
export const DEFAULT_WHISPER_TRANSCRIBE_PATH = '/transcribe';
export const DEFAULT_WHISPER_FILES_PATH = '/files';
export const DEFAULT_WHISPER_URL = `${DEFAULT_WHISPER_ORIGIN}${DEFAULT_WHISPER_TRANSCRIBE_PATH}`;
export const DEFAULT_WHISPER_FILES_URL = `${DEFAULT_WHISPER_ORIGIN}${DEFAULT_WHISPER_FILES_PATH}`;
export const DEFAULT_WHISPER_WASM_MODEL = 'Xenova/whisper-tiny.en';

/** Hugging Face weight hosts — opt-in WASM model download only. Audio never leaves the device. */
export const WHISPER_WASM_MODEL_CONNECT_ORIGINS = [
  'https://huggingface.co',
  'https://cdn-lfs.huggingface.co',
  'https://cdn-lfs-us-1.huggingface.co',
  'https://cas-bridge.xethub.hf.co',
] as const;

const DEFAULT_CONFIG: PushToTalkConfig = {
  engine: 'sidecar',
  whisperUrl: DEFAULT_WHISPER_URL,
  filesUrl: DEFAULT_WHISPER_FILES_URL,
  timeoutMs: 90_000,
  maxAudioBytes: 10 * 1024 * 1024,
  maxFileBytes: 25 * 1024 * 1024,
  model: 'small',
  wasmModel: DEFAULT_WHISPER_WASM_MODEL,
  mimeType: 'audio/webm',
};

function readEngine(value: string | undefined): WhisperEngine {
  if (value === 'wasm' || value === 'sidecar' || value === 'auto') return value;
  return 'sidecar';
}

function configFromEnv(
  env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {},
): PushToTalkConfig {
  const whisperUrl = resolveWhisperUrl(env.NEXT_PUBLIC_WHISPER_URL ?? env.WHISPER_URL);
  return {
    ...DEFAULT_CONFIG,
    engine: readEngine(env.NEXT_PUBLIC_WHISPER_ENGINE),
    whisperUrl,
    filesUrl: resolveSidecarFilesUrl(
      whisperUrl,
      env.NEXT_PUBLIC_WHISPER_FILES_URL ?? env.WHISPER_FILES_URL,
    ),
    wasmModel: env.NEXT_PUBLIC_WHISPER_WASM_MODEL?.trim() || DEFAULT_WHISPER_WASM_MODEL,
  };
}

let config: PushToTalkConfig = configFromEnv();

export function getPushToTalkConfig(): PushToTalkConfig {
  return config;
}

export function configurePushToTalk(overrides: Partial<PushToTalkConfig>): void {
  const next = { ...configFromEnv(), ...overrides };
  if (!overrides.filesUrl) {
    next.filesUrl = resolveSidecarFilesUrl(next.whisperUrl);
  }
  config = next;
}

export function resetPushToTalkConfig(): void {
  config = configFromEnv();
}

/** Unset / blank → documented loopback `/transcribe`. Never a cloud STT host. */
export function resolveWhisperUrl(envValue?: string | null): string {
  const trimmed = envValue?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_WHISPER_URL;
}

export function readWhisperUrlFromEnv(
  env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {},
): string {
  return resolveWhisperUrl(env.NEXT_PUBLIC_WHISPER_URL ?? env.WHISPER_URL);
}

/**
 * Files live on the same sidecar origin a future Tauri shell will own.
 * Hosted `.com` never reads OS paths.
 */
export function resolveSidecarFilesUrl(
  whisperUrl: string,
  filesUrlOverride?: string | null,
): string {
  const override = filesUrlOverride?.trim();
  if (override && override.length > 0) return override;
  const trimmed = whisperUrl.trim();
  if (trimmed.length === 0) return DEFAULT_WHISPER_FILES_URL;
  if (isSameOriginWhisperPath(trimmed)) return DEFAULT_WHISPER_FILES_PATH;
  try {
    return `${new URL(trimmed).origin}${DEFAULT_WHISPER_FILES_PATH}`;
  } catch {
    return DEFAULT_WHISPER_FILES_URL;
  }
}

export function resolveWhisperEngine(
  cfg: Pick<PushToTalkConfig, 'engine' | 'whisperUrl'> = getPushToTalkConfig(),
): ResolvedWhisperEngine {
  if (cfg.engine === 'wasm') return 'wasm';
  return 'sidecar';
}
