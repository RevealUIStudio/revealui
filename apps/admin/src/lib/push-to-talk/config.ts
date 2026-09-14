/**
 * Studio dogfood push-to-talk — on-device WASM (phone) + localhost sidecar (laptop).
 * Not a public SKU.
 */

export type WhisperEngine = 'auto' | 'wasm' | 'sidecar';
export type ResolvedWhisperEngine = 'wasm' | 'sidecar';

export interface PushToTalkConfig {
  /**
   * `auto` uses WASM when no sidecar URL is set (phone seat).
   * An explicit WHISPER_URL selects the laptop sidecar (or CF tunnel).
   */
  engine: WhisperEngine;
  /** OpenAI-compatible sidecar URL. Empty means "no sidecar — use WASM". */
  whisperUrl: string;
  /** How long to wait for sidecar / first WASM load. */
  timeoutMs: number;
  /** Reject oversized MediaRecorder blobs. */
  maxAudioBytes: number;
  /** Sidecar model class (YouTube pipeline family: `small`). */
  model: string;
  /** transformers.js / Xenova checkpoint for on-device WASM. */
  wasmModel: string;
  /** Preferred MediaRecorder MIME type before Safari fallbacks. */
  mimeType: string;
}

export const DEFAULT_WHISPER_ORIGIN = 'http://127.0.0.1:8178';
export const DEFAULT_WHISPER_TRANSCRIBE_PATH = '/v1/audio/transcriptions';
export const DEFAULT_WHISPER_URL = `${DEFAULT_WHISPER_ORIGIN}${DEFAULT_WHISPER_TRANSCRIBE_PATH}`;
export const DEFAULT_WHISPER_WASM_MODEL = 'Xenova/whisper-tiny.en';

/** Hugging Face weight hosts — model download only. Audio never leaves the device. */
export const WHISPER_WASM_MODEL_CONNECT_ORIGINS = [
  'https://huggingface.co',
  'https://cdn-lfs.huggingface.co',
  'https://cdn-lfs-us-1.huggingface.co',
  'https://cas-bridge.xethub.hf.co',
] as const;

const DEFAULT_CONFIG: PushToTalkConfig = {
  engine: 'auto',
  whisperUrl: '',
  timeoutMs: 90_000,
  maxAudioBytes: 10 * 1024 * 1024,
  model: 'small',
  wasmModel: DEFAULT_WHISPER_WASM_MODEL,
  mimeType: 'audio/webm',
};

function readEngine(value: string | undefined): WhisperEngine {
  if (value === 'wasm' || value === 'sidecar' || value === 'auto') return value;
  return 'auto';
}

function configFromEnv(
  env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {},
): PushToTalkConfig {
  return {
    ...DEFAULT_CONFIG,
    engine: readEngine(env.NEXT_PUBLIC_WHISPER_ENGINE),
    whisperUrl: resolveWhisperUrl(env.NEXT_PUBLIC_WHISPER_URL ?? env.WHISPER_URL),
    wasmModel: env.NEXT_PUBLIC_WHISPER_WASM_MODEL?.trim() || DEFAULT_WHISPER_WASM_MODEL,
  };
}

let config: PushToTalkConfig = configFromEnv();

export function getPushToTalkConfig(): PushToTalkConfig {
  return config;
}

export function configurePushToTalk(overrides: Partial<PushToTalkConfig>): void {
  config = { ...configFromEnv(), ...overrides };
}

export function resetPushToTalkConfig(): void {
  config = configFromEnv();
}

/** Empty / unset → no sidecar (WASM). Do not default to 127.0.0.1 on phones. */
export function resolveWhisperUrl(envValue?: string | null): string {
  return envValue?.trim() ?? '';
}

export function readWhisperUrlFromEnv(
  env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {},
): string {
  return resolveWhisperUrl(env.NEXT_PUBLIC_WHISPER_URL ?? env.WHISPER_URL);
}

export function resolveWhisperEngine(
  cfg: Pick<PushToTalkConfig, 'engine' | 'whisperUrl'> = getPushToTalkConfig(),
): ResolvedWhisperEngine {
  if (cfg.engine === 'wasm' || cfg.engine === 'sidecar') return cfg.engine;
  return cfg.whisperUrl.length > 0 ? 'sidecar' : 'wasm';
}
