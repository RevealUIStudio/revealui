import { getPushToTalkConfig, resolveWhisperEngine } from './config';
import { isAllowedWhisperEndpoint } from './policy';
import type { TranscribeFailureReason, TranscribeResult } from './types';
import { transcribeWithWasm } from './wasm';

export type { TranscribeFailureReason, TranscribeResult };

export interface TranscribeLocalWhisperOptions {
  fetch?: typeof fetch;
  url?: string;
  timeoutMs?: number;
  model?: string;
  maxAudioBytes?: number;
}

export interface TranscribeVoiceOptions extends TranscribeLocalWhisperOptions {
  wasm?: typeof transcribeWithWasm;
}

const SIDECAR_MISSING_MESSAGE =
  'Local Whisper sidecar is not reachable. On a laptop, start whisper small at http://127.0.0.1:8178. On a phone, leave WHISPER_URL unset to use on-device Whisper, or point it at a Cloudflare Tunnel to the laptop sidecar — see docs/runbooks/admin-chat-local-whisper.md.';

const FORBIDDEN_MESSAGE =
  'Voice input only talks to on-device Whisper or an operator-pinned local/tunnel sidecar. Cloud speech-to-text is disabled.';

function readTranscriptPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const rec = payload as Record<string, unknown>;
  if (typeof rec.text === 'string') return rec.text;
  if (typeof rec.transcript === 'string') return rec.transcript;
  if (typeof rec.transcription === 'string') return rec.transcription;
  return null;
}

function fail(reason: TranscribeFailureReason, message: string): TranscribeResult {
  return { ok: false, reason, message };
}

/**
 * POST audio to an operator-pinned OpenAI-compatible Whisper sidecar.
 * Fail closed when the sidecar is missing or the URL is a cloud STT host.
 */
export async function transcribeLocalWhisper(
  audio: Blob,
  options: TranscribeLocalWhisperOptions = {},
): Promise<TranscribeResult> {
  const cfg = getPushToTalkConfig();
  const resolvedUrl = options.url ?? (cfg.whisperUrl.length > 0 ? cfg.whisperUrl : '');
  const timeoutMs = options.timeoutMs ?? cfg.timeoutMs;
  const model = options.model ?? cfg.model;
  const maxAudioBytes = options.maxAudioBytes ?? cfg.maxAudioBytes;
  const fetchImpl = options.fetch ?? globalThis.fetch;

  if (!resolvedUrl) {
    return fail('sidecar-unavailable', SIDECAR_MISSING_MESSAGE);
  }
  if (!isAllowedWhisperEndpoint(resolvedUrl)) {
    return fail('forbidden-endpoint', FORBIDDEN_MESSAGE);
  }

  if (audio.size === 0) {
    return fail('empty-audio', 'No audio captured. Hold the mic and speak, then release.');
  }

  if (audio.size > maxAudioBytes) {
    return fail('too-large', 'Recording is too long. Hold to talk with a shorter clip.');
  }

  if (typeof fetchImpl !== 'function') {
    return fail('sidecar-unavailable', SIDECAR_MISSING_MESSAGE);
  }

  const form = new FormData();
  const filename = audio.type.includes('wav')
    ? 'speech.wav'
    : audio.type.includes('mp4')
      ? 'speech.m4a'
      : 'speech.webm';
  form.append('file', audio, filename);
  form.append('model', model);
  form.append('response_format', 'json');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(resolvedUrl, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });

    if (!response.ok) {
      return fail('sidecar-unavailable', SIDECAR_MISSING_MESSAGE);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return fail('invalid-response', 'Local Whisper returned a response we could not read.');
    }

    const text = readTranscriptPayload(payload);
    if (text === null) {
      return fail('invalid-response', 'Local Whisper returned no transcript text.');
    }

    return { ok: true, text };
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    if (name === 'AbortError') {
      return fail('timeout', 'Local Whisper timed out. Check the sidecar and try a shorter clip.');
    }
    return fail('sidecar-unavailable', SIDECAR_MISSING_MESSAGE);
  } finally {
    clearTimeout(timer);
  }
}

/** Phone default: on-device WASM. Laptop / tunnel: sidecar when WHISPER_URL is set. */
export async function transcribeVoice(
  audio: Blob,
  options: TranscribeVoiceOptions = {},
): Promise<TranscribeResult> {
  const engine = resolveWhisperEngine();
  if (engine === 'wasm') {
    const wasm = options.wasm ?? transcribeWithWasm;
    return wasm(audio);
  }
  return transcribeLocalWhisper(audio, options);
}

export const LOCAL_WHISPER_FAIL_CLOSED_MESSAGE = SIDECAR_MISSING_MESSAGE;
