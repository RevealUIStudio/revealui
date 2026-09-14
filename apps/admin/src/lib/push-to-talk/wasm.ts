import { decodeAudioBlobToMono16k } from './audio';
import { getPushToTalkConfig } from './config';
import type { TranscribeResult } from './types';

export type WasmAsrPipeline = (
  audio: { array: Float32Array; sampling_rate: number },
  options?: { language?: string },
) => Promise<unknown>;

export type WasmWhisperLoader = () => Promise<WasmAsrPipeline>;

export const WASM_UNAVAILABLE_MESSAGE =
  'On-device Whisper could not start in this browser. Use HTTPS admin, allow the microphone, or set WHISPER_URL to a laptop sidecar / Cloudflare Tunnel — see docs/runbooks/admin-chat-local-whisper.md.';

function fail(message: string): TranscribeResult {
  return { ok: false, reason: 'sidecar-unavailable', message };
}

function readAsrText(payload: unknown): string | null {
  if (typeof payload === 'string') return payload;
  if (!payload || typeof payload !== 'object') return null;
  const text = (payload as { text?: unknown }).text;
  return typeof text === 'string' ? text : null;
}

let cachedPipeline: WasmAsrPipeline | null = null;
let cachedModel = '';

async function defaultLoadWasmAsr(): Promise<WasmAsrPipeline> {
  const model = getPushToTalkConfig().wasmModel;
  if (cachedPipeline && cachedModel === model) return cachedPipeline;

  let pipelineFn: unknown;
  try {
    const transformers = await import('@huggingface/transformers');
    pipelineFn = transformers.pipeline;
  } catch {
    throw new Error(WASM_UNAVAILABLE_MESSAGE);
  }
  if (typeof pipelineFn !== 'function') {
    throw new Error(WASM_UNAVAILABLE_MESSAGE);
  }

  const asr = await (
    pipelineFn as (
      task: string,
      modelId: string,
      options: { device: string; dtype: string },
    ) => Promise<WasmAsrPipeline>
  )('automatic-speech-recognition', model, { device: 'wasm', dtype: 'q8' });

  cachedPipeline = asr;
  cachedModel = model;
  return asr;
}

export function resetWasmWhisperCache(): void {
  cachedPipeline = null;
  cachedModel = '';
}

/**
 * Run Whisper in-process. Audio stays on the device. The first call may
 * download the Xenova checkpoint (weights only — not a cloud STT API).
 */
export async function transcribeWithWasm(
  audio: Blob,
  options: {
    loadPipeline?: WasmWhisperLoader;
    decode?: (buffer: ArrayBuffer) => Promise<AudioBuffer>;
  } = {},
): Promise<TranscribeResult> {
  if (audio.size === 0) {
    return {
      ok: false,
      reason: 'empty-audio',
      message: 'No audio captured. Hold the mic and speak, then release.',
    };
  }

  let samples: Float32Array;
  let sampleRate: number;
  try {
    const decoded = await decodeAudioBlobToMono16k(audio, options.decode);
    samples = decoded.samples;
    sampleRate = decoded.sampleRate;
  } catch {
    return fail(WASM_UNAVAILABLE_MESSAGE);
  }

  if (samples.length === 0) {
    return {
      ok: false,
      reason: 'empty-audio',
      message: 'No speech detected. Hold to talk and try again.',
    };
  }

  const load = options.loadPipeline ?? defaultLoadWasmAsr;
  try {
    const asr = await load();
    const payload = await asr({ array: samples, sampling_rate: sampleRate }, { language: 'en' });
    const text = readAsrText(payload);
    if (text === null) {
      return {
        ok: false,
        reason: 'invalid-response',
        message: 'On-device Whisper returned no transcript text.',
      };
    }
    return { ok: true, text };
  } catch {
    return fail(WASM_UNAVAILABLE_MESSAGE);
  }
}
