import { getPushToTalkConfig } from './config';
import { isAllowedWhisperEndpoint } from './policy';

export type TranscribeFailureReason =
  | 'sidecar-unavailable'
  | 'forbidden-endpoint'
  | 'empty-audio'
  | 'invalid-response'
  | 'timeout'
  | 'too-large';

export type TranscribeResult =
  | { ok: true; text: string }
  | { ok: false; reason: TranscribeFailureReason; message: string };

export interface TranscribeLocalWhisperOptions {
  fetch?: typeof fetch;
  url?: string;
  timeoutMs?: number;
  model?: string;
  maxAudioBytes?: number;
}

const SIDECAR_MISSING_MESSAGE =
  'Local Whisper sidecar is not running. Start whisper small on loopback (WHISPER_URL, default http://127.0.0.1:8178) — see docs/runbooks/admin-chat-local-whisper.md.';

const FORBIDDEN_MESSAGE =
  'Voice input only talks to a local Whisper sidecar. Cloud speech-to-text is disabled.';

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
 * POST audio to a local OpenAI-compatible Whisper endpoint.
 * Fail closed when the sidecar is missing or the URL is not loopback.
 */
export async function transcribeLocalWhisper(
  audio: Blob,
  options: TranscribeLocalWhisperOptions = {},
): Promise<TranscribeResult> {
  const cfg = getPushToTalkConfig();
  const url = options.url ?? cfg.whisperUrl;
  const timeoutMs = options.timeoutMs ?? cfg.timeoutMs;
  const model = options.model ?? cfg.model;
  const maxAudioBytes = options.maxAudioBytes ?? cfg.maxAudioBytes;
  const fetchImpl = options.fetch ?? globalThis.fetch;

  if (!isAllowedWhisperEndpoint(url)) {
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
  const filename = audio.type.includes('wav') ? 'speech.wav' : 'speech.webm';
  form.append('file', audio, filename);
  form.append('model', model);
  form.append('response_format', 'json');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
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

export const LOCAL_WHISPER_FAIL_CLOSED_MESSAGE = SIDECAR_MISSING_MESSAGE;
