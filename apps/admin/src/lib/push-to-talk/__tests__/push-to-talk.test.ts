import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  configurePushToTalk,
  DEFAULT_WHISPER_ORIGIN,
  DEFAULT_WHISPER_URL,
  DEFAULT_WHISPER_WASM_MODEL,
  insertTranscript,
  isAllowedWhisperEndpoint,
  isCloudflareTunnelHostname,
  isLoopbackHostname,
  isPrivateIpv4Hostname,
  isSaasSttHostname,
  LOCAL_WHISPER_FAIL_CLOSED_MESSAGE,
  mixToMono,
  pickRecorderMimeType,
  readWhisperUrlFromEnv,
  resampleLinear,
  resetPushToTalkConfig,
  resetWasmWhisperCache,
  resolveWhisperEngine,
  resolveWhisperUrl,
  transcribeLocalWhisper,
  transcribeVoice,
  transcribeWithWasm,
  WASM_UNAVAILABLE_MESSAGE,
  whisperConnectSrcOrigin,
} from '../index';

afterEach(() => {
  resetPushToTalkConfig();
  resetWasmWhisperCache();
});

describe('isLoopbackHostname', () => {
  it('allows localhost and IPv4 / IPv6 loopback', () => {
    expect(isLoopbackHostname('127.0.0.1')).toBe(true);
    expect(isLoopbackHostname('127.0.0.9')).toBe(true);
    expect(isLoopbackHostname('localhost')).toBe(true);
    expect(isLoopbackHostname('LOCALHOST')).toBe(true);
    expect(isLoopbackHostname('::1')).toBe(true);
    expect(isLoopbackHostname('[::1]')).toBe(true);
  });

  it('rejects public hosts', () => {
    expect(isLoopbackHostname('openai.com')).toBe(false);
    expect(isLoopbackHostname('8.8.8.8')).toBe(false);
  });
});

describe('LAN + Cloudflare tunnel hosts', () => {
  it('recognizes RFC1918 laptop addresses', () => {
    expect(isPrivateIpv4Hostname('192.168.1.10')).toBe(true);
    expect(isPrivateIpv4Hostname('10.0.0.2')).toBe(true);
    expect(isPrivateIpv4Hostname('172.16.0.1')).toBe(true);
    expect(isPrivateIpv4Hostname('8.8.8.8')).toBe(false);
  });

  it('recognizes Cloudflare quick tunnels and refuses STT SaaS', () => {
    expect(isCloudflareTunnelHostname('random-name.trycloudflare.com')).toBe(true);
    expect(isSaasSttHostname('api.openai.com')).toBe(true);
    expect(
      isAllowedWhisperEndpoint('https://random-name.trycloudflare.com/v1/audio/transcriptions'),
    ).toBe(true);
    expect(isAllowedWhisperEndpoint('http://192.168.1.10:8178/v1/audio/transcriptions')).toBe(true);
    expect(isAllowedWhisperEndpoint('https://api.openai.com/v1/audio/transcriptions')).toBe(false);
    expect(isAllowedWhisperEndpoint('https://api.assemblyai.com/v2/transcript')).toBe(false);
    expect(isAllowedWhisperEndpoint('https://api.deepgram.com/v1/listen')).toBe(false);
  });
});

describe('isAllowedWhisperEndpoint', () => {
  it('allows the loopback OpenAI-compatible path and same-origin', () => {
    expect(isAllowedWhisperEndpoint(DEFAULT_WHISPER_URL)).toBe(true);
    expect(isAllowedWhisperEndpoint('http://localhost:8178/v1/audio/transcriptions')).toBe(true);
    expect(isAllowedWhisperEndpoint('/api/stt')).toBe(true);
  });

  it('refuses protocol-relative and empty values', () => {
    expect(isAllowedWhisperEndpoint('')).toBe(false);
    expect(isAllowedWhisperEndpoint('   ')).toBe(false);
    expect(isAllowedWhisperEndpoint('//evil.example/stt')).toBe(false);
  });
});

describe('whisperConnectSrcOrigin', () => {
  it('returns loopback, LAN, and tunnel origins and never a cloud STT origin', () => {
    expect(whisperConnectSrcOrigin(DEFAULT_WHISPER_URL)).toBe(DEFAULT_WHISPER_ORIGIN);
    expect(whisperConnectSrcOrigin('http://192.168.1.10:8178/v1/audio/transcriptions')).toBe(
      'http://192.168.1.10:8178',
    );
    expect(whisperConnectSrcOrigin('https://abc.trycloudflare.com/v1/audio/transcriptions')).toBe(
      'https://abc.trycloudflare.com',
    );
    expect(whisperConnectSrcOrigin('https://api.openai.com/v1/audio/transcriptions')).toBe('');
  });
});

describe('resolveWhisperEngine', () => {
  it("defaults to wasm so a phone does not call the phone's own 127.0.0.1", () => {
    expect(resolveWhisperUrl(undefined)).toBe('');
    expect(resolveWhisperUrl('')).toBe('');
    expect(readWhisperUrlFromEnv({})).toBe('');
    expect(resolveWhisperEngine()).toBe('wasm');
    expect(DEFAULT_WHISPER_WASM_MODEL).toBe('Xenova/whisper-tiny.en');
  });

  it('selects sidecar when WHISPER_URL is set', () => {
    expect(
      readWhisperUrlFromEnv({
        NEXT_PUBLIC_WHISPER_URL: 'http://127.0.0.1:9000/v1/audio/transcriptions',
      }),
    ).toBe('http://127.0.0.1:9000/v1/audio/transcriptions');
    configurePushToTalk({ whisperUrl: 'http://127.0.0.1:8178/v1/audio/transcriptions' });
    expect(resolveWhisperEngine()).toBe('sidecar');
  });
});

describe('insertTranscript', () => {
  it('inserts into an empty composer', () => {
    expect(insertTranscript('', 'Show published posts')).toBe('Show published posts');
  });

  it('appends to typed text with a single space', () => {
    expect(insertTranscript('Please ', 'list users')).toBe('Please list users');
    expect(insertTranscript('Please', 'list users')).toBe('Please list users');
  });

  it('does not change the composer when Whisper returns blank audio', () => {
    expect(insertTranscript('Keep me', '   ')).toBe('Keep me');
  });
});

describe('audio helpers', () => {
  it('picks a Safari-friendly mime when webm is missing', () => {
    expect(pickRecorderMimeType((type) => type === 'audio/mp4')).toBe('audio/mp4');
    expect(pickRecorderMimeType(() => false)).toBe('');
  });

  it('mixes stereo to mono and resamples to 16 kHz', () => {
    const left = new Float32Array([1, 1]);
    const right = new Float32Array([0, 0]);
    expect(Array.from(mixToMono([left, right]))).toEqual([0.5, 0.5]);
    const resampled = resampleLinear(new Float32Array([0, 1]), 8_000, 16_000);
    expect(resampled.length).toBe(4);
  });
});

describe('transcribeLocalWhisper', () => {
  it('POSTs audio to the local sidecar and returns text', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'Show me all published posts' }),
    });
    const audio = new Blob(['wav'], { type: 'audio/webm' });

    const result = await transcribeLocalWhisper(audio, {
      fetch: fetchImpl,
      url: DEFAULT_WHISPER_URL,
    });

    expect(result).toEqual({ ok: true, text: 'Show me all published posts' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(DEFAULT_WHISPER_URL);
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    const form = init.body as FormData;
    expect(form.get('model')).toBe('small');
  });

  it('fail-closes with a sidecar-missing message when the endpoint is down', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const result = await transcribeLocalWhisper(new Blob(['x']), {
      fetch: fetchImpl,
      url: DEFAULT_WHISPER_URL,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('sidecar-unavailable');
    expect(result.message).toBe(LOCAL_WHISPER_FAIL_CLOSED_MESSAGE);
  });

  it('fail-closes on HTTP errors from the sidecar', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
    const result = await transcribeLocalWhisper(new Blob(['x']), {
      fetch: fetchImpl,
      url: DEFAULT_WHISPER_URL,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('sidecar-unavailable');
  });

  it('refuses to call a cloud STT URL', async () => {
    const fetchImpl = vi.fn();
    configurePushToTalk({ whisperUrl: 'https://api.openai.com/v1/audio/transcriptions' });

    const result = await transcribeLocalWhisper(new Blob(['x']), { fetch: fetchImpl });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('forbidden-endpoint');
  });

  it('rejects empty audio before touching the network', async () => {
    const fetchImpl = vi.fn();
    const result = await transcribeLocalWhisper(new Blob([]), {
      fetch: fetchImpl,
      url: DEFAULT_WHISPER_URL,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('empty-audio');
  });
});

describe('transcribeVoice', () => {
  it('uses on-device WASM when no sidecar URL is configured', async () => {
    const result = await transcribeVoice(new Blob(['x']), {
      wasm: async () => ({ ok: true, text: 'From the phone' }),
    });
    expect(result).toEqual({ ok: true, text: 'From the phone' });
  });

  it('uses the sidecar when WHISPER_URL is set', async () => {
    configurePushToTalk({ whisperUrl: DEFAULT_WHISPER_URL });
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'From the laptop sidecar' }),
    });
    const result = await transcribeVoice(new Blob(['x']), { fetch: fetchImpl });
    expect(result).toEqual({ ok: true, text: 'From the laptop sidecar' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('transcribeWithWasm', () => {
  it('decodes audio and returns pipeline text without leaving the device', async () => {
    const result = await transcribeWithWasm(new Blob(['x']), {
      decode: async () =>
        ({
          numberOfChannels: 1,
          sampleRate: 16_000,
          getChannelData: () => new Float32Array([0.1, 0.2]),
        }) as AudioBuffer,
      loadPipeline: async () => async () => ({ text: 'On device transcript' }),
    });
    expect(result).toEqual({ ok: true, text: 'On device transcript' });
  });

  it('fail-closes when the WASM pipeline cannot start', async () => {
    const result = await transcribeWithWasm(new Blob(['x']), {
      decode: async () =>
        ({
          numberOfChannels: 1,
          sampleRate: 16_000,
          getChannelData: () => new Float32Array([0.1]),
        }) as AudioBuffer,
      loadPipeline: async () => {
        throw new Error('missing wasm');
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toBe(WASM_UNAVAILABLE_MESSAGE);
  });
});
