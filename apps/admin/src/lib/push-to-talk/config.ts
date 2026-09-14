/**
 * Studio dogfood push-to-talk — local Whisper sidecar only.
 * Not a public SKU. Defaults stay on-device / loopback.
 */

export interface PushToTalkConfig {
  /** OpenAI-compatible transcribe URL (default: loopback whisper.cpp / faster-whisper). */
  whisperUrl: string;
  /** How long to wait for the sidecar (CPU `small` can be slow). */
  timeoutMs: number;
  /** Reject oversized recordings before upload. */
  maxAudioBytes: number;
  /** Model class sent to the sidecar (YouTube pipeline family: `small`). */
  model: string;
  /** Preferred MediaRecorder MIME type. */
  mimeType: string;
}

export const DEFAULT_WHISPER_ORIGIN = 'http://127.0.0.1:8178';
export const DEFAULT_WHISPER_TRANSCRIBE_PATH = '/v1/audio/transcriptions';
export const DEFAULT_WHISPER_URL = `${DEFAULT_WHISPER_ORIGIN}${DEFAULT_WHISPER_TRANSCRIBE_PATH}`;

const DEFAULT_CONFIG: PushToTalkConfig = {
  whisperUrl: DEFAULT_WHISPER_URL,
  timeoutMs: 45_000,
  maxAudioBytes: 10 * 1024 * 1024,
  model: 'small',
  mimeType: 'audio/webm',
};

function configFromEnv(
  env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {},
): PushToTalkConfig {
  return {
    ...DEFAULT_CONFIG,
    whisperUrl: resolveWhisperUrl(env.NEXT_PUBLIC_WHISPER_URL ?? env.WHISPER_URL),
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

/** Resolve the browser-facing sidecar URL. Empty / unset → loopback default. */
export function resolveWhisperUrl(envValue?: string | null): string {
  const trimmed = envValue?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : DEFAULT_WHISPER_URL;
}

export function readWhisperUrlFromEnv(
  env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {},
): string {
  return resolveWhisperUrl(env.NEXT_PUBLIC_WHISPER_URL ?? env.WHISPER_URL);
}
