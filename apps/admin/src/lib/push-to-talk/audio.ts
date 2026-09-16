const TARGET_SAMPLE_RATE = 16_000;

const RECORDER_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/aac',
] as const;

export function pickRecorderMimeType(isTypeSupported?: (mimeType: string) => boolean): string {
  if (!isTypeSupported) return '';
  for (const candidate of RECORDER_MIME_CANDIDATES) {
    if (isTypeSupported(candidate)) return candidate;
  }
  return '';
}

export function mixToMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 0) return new Float32Array(0);
  const first = channels[0];
  if (!first) return new Float32Array(0);
  if (channels.length === 1) return first;
  const length = first.length;
  const mixed = new Float32Array(length);
  const count = channels.length;
  for (let i = 0; i < length; i += 1) {
    let sum = 0;
    for (const channel of channels) {
      sum += channel[i] ?? 0;
    }
    mixed[i] = sum / count;
  }
  return mixed;
}

export function resampleLinear(
  input: Float32Array,
  fromRate: number,
  toRate: number = TARGET_SAMPLE_RATE,
): Float32Array {
  if (input.length === 0 || fromRate <= 0) return new Float32Array(0);
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const outLength = Math.max(1, Math.round(input.length / ratio));
  const output = new Float32Array(outLength);
  for (let i = 0; i < outLength; i += 1) {
    const src = i * ratio;
    const left = Math.floor(src);
    const right = Math.min(left + 1, input.length - 1);
    const frac = src - left;
    const a = input[left] ?? 0;
    const b = input[right] ?? 0;
    output[i] = a + (b - a) * frac;
  }
  return output;
}

export async function decodeAudioBlobToMono16k(
  audio: Blob,
  decode: (buffer: ArrayBuffer) => Promise<AudioBuffer> = decodeWithAudioContext,
): Promise<{ samples: Float32Array; sampleRate: number }> {
  const copy = await audio.arrayBuffer();
  const decoded = await decode(copy);
  const channels: Float32Array[] = [];
  for (let i = 0; i < decoded.numberOfChannels; i += 1) {
    channels.push(decoded.getChannelData(i));
  }
  const mono = mixToMono(channels);
  return {
    samples: resampleLinear(mono, decoded.sampleRate, TARGET_SAMPLE_RATE),
    sampleRate: TARGET_SAMPLE_RATE,
  };
}

async function decodeWithAudioContext(buffer: ArrayBuffer): Promise<AudioBuffer> {
  const Ctor = (
    globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
  ).AudioContext;
  const Webkit = (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  const Context = Ctor ?? Webkit;
  if (!Context) {
    throw new Error('This browser cannot decode microphone audio for on-device Whisper.');
  }
  const context = new Context();
  try {
    return await context.decodeAudioData(buffer.slice(0));
  } finally {
    void context.close();
  }
}
