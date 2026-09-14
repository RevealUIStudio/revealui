import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  configurePushToTalk,
  DEFAULT_WHISPER_FILES_PATH,
  DEFAULT_WHISPER_FILES_URL,
  DEFAULT_WHISPER_ORIGIN,
  DEFAULT_WHISPER_TRANSCRIBE_PATH,
  DEFAULT_WHISPER_URL,
  DEFAULT_WHISPER_WASM_MODEL,
  DOGFOOD_WHISPER_TUNNEL_HOST,
  DOGFOOD_WHISPER_TUNNEL_ORIGIN,
  insertLocalFileRef,
  insertTranscript,
  isAllowedWhisperEndpoint,
  isDogfoodWhisperTunnelHostname,
  isLoopbackHostname,
  isPrivateIpv4Hostname,
  isSaasSttHostname,
  LOCAL_SIDECAR_FILES_FAIL_CLOSED_MESSAGE,
  LOCAL_WHISPER_FAIL_CLOSED_MESSAGE,
  listSidecarFiles,
  mixToMono,
  pickRecorderMimeType,
  readWhisperUrlFromEnv,
  resampleLinear,
  resetPushToTalkConfig,
  resetWasmWhisperCache,
  resolveSidecarFilesUrl,
  resolveWhisperEngine,
  resolveWhisperUrl,
  transcribeLocalWhisper,
  transcribeVoice,
  transcribeWithWasm,
  uploadSidecarFile,
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

describe('LAN + dogfood tunnel hosts', () => {
  it('recognizes RFC1918 addresses but does not allow them as Whisper endpoints', () => {
    expect(isPrivateIpv4Hostname('192.168.1.10')).toBe(true);
    expect(isPrivateIpv4Hostname('10.0.0.2')).toBe(true);
    expect(isPrivateIpv4Hostname('172.16.0.1')).toBe(true);
    expect(isPrivateIpv4Hostname('8.8.8.8')).toBe(false);
    expect(isAllowedWhisperEndpoint('http://192.168.1.10:8178/transcribe')).toBe(false);
  });

  it('allows only the documented dogfood Access host, not wildcard tunnels or STT SaaS', () => {
    expect(DOGFOOD_WHISPER_TUNNEL_HOST).toBe('chat.revbot.revealui.com');
    expect(isDogfoodWhisperTunnelHostname(DOGFOOD_WHISPER_TUNNEL_HOST)).toBe(true);
    expect(isDogfoodWhisperTunnelHostname('random-name.trycloudflare.com')).toBe(false);
    expect(isSaasSttHostname('api.openai.com')).toBe(true);
    expect(isAllowedWhisperEndpoint(`${DOGFOOD_WHISPER_TUNNEL_ORIGIN}/transcribe`)).toBe(true);
    expect(
      isAllowedWhisperEndpoint('https://random-name.trycloudflare.com/v1/audio/transcriptions'),
    ).toBe(false);
    expect(isAllowedWhisperEndpoint('https://api.openai.com/v1/audio/transcriptions')).toBe(false);
    expect(isAllowedWhisperEndpoint('https://api.assemblyai.com/v2/transcript')).toBe(false);
    expect(isAllowedWhisperEndpoint('https://api.deepgram.com/v1/listen')).toBe(false);
  });
});

describe('isAllowedWhisperEndpoint', () => {
  it('allows the documented loopback /transcribe contract', () => {
    expect(DEFAULT_WHISPER_TRANSCRIBE_PATH).toBe('/transcribe');
    expect(isAllowedWhisperEndpoint(DEFAULT_WHISPER_URL)).toBe(true);
    expect(isAllowedWhisperEndpoint('http://localhost:8178/transcribe')).toBe(true);
    expect(isAllowedWhisperEndpoint('http://localhost:8178/v1/audio/transcriptions')).toBe(true);
    expect(isAllowedWhisperEndpoint('http://[::1]:8178/transcribe')).toBe(true);
    expect(isAllowedWhisperEndpoint('/api/stt')).toBe(false);
  });

  it('allow-list rejects evil.example so it cannot enter CSP connect-src', () => {
    const evil = 'https://evil.example/stt';
    expect(isAllowedWhisperEndpoint(evil)).toBe(false);
    expect(whisperConnectSrcOrigin(evil)).toBe('');
    expect(isAllowedWhisperEndpoint('http://evil.example/transcribe')).toBe(false);
    expect(isAllowedWhisperEndpoint('https://chat.revbot.revealui.com.evil.example/stt')).toBe(
      false,
    );
  });

  it('refuses protocol-relative and empty values', () => {
    expect(isAllowedWhisperEndpoint('')).toBe(false);
    expect(isAllowedWhisperEndpoint('   ')).toBe(false);
    expect(isAllowedWhisperEndpoint('//evil.example/stt')).toBe(false);
  });
});

describe('whisperConnectSrcOrigin', () => {
  it('returns loopback and the dogfood Access origin and never an arbitrary host', () => {
    expect(whisperConnectSrcOrigin(DEFAULT_WHISPER_URL)).toBe(DEFAULT_WHISPER_ORIGIN);
    expect(whisperConnectSrcOrigin(`${DOGFOOD_WHISPER_TUNNEL_ORIGIN}/transcribe`)).toBe(
      DOGFOOD_WHISPER_TUNNEL_ORIGIN,
    );
    expect(whisperConnectSrcOrigin('http://192.168.1.10:8178/transcribe')).toBe('');
    expect(whisperConnectSrcOrigin('https://abc.trycloudflare.com/transcribe')).toBe('');
    expect(whisperConnectSrcOrigin('https://evil.example/stt')).toBe('');
    expect(whisperConnectSrcOrigin('https://api.openai.com/v1/audio/transcriptions')).toBe('');
  });
});

describe('resolveWhisperEngine', () => {
  it('defaults to the laptop localhost sidecar, not hosted WASM', () => {
    expect(resolveWhisperUrl(undefined)).toBe(DEFAULT_WHISPER_URL);
    expect(resolveWhisperUrl('')).toBe(DEFAULT_WHISPER_URL);
    expect(readWhisperUrlFromEnv({})).toBe(DEFAULT_WHISPER_URL);
    expect(resolveWhisperEngine()).toBe('sidecar');
    expect(DEFAULT_WHISPER_URL).toBe('http://127.0.0.1:8178/transcribe');
    expect(DEFAULT_WHISPER_WASM_MODEL).toBe('Xenova/whisper-tiny.en');
  });

  it('keeps sidecar when WHISPER_URL is an operator override', () => {
    expect(
      readWhisperUrlFromEnv({
        NEXT_PUBLIC_WHISPER_URL: 'http://127.0.0.1:9000/v1/audio/transcriptions',
      }),
    ).toBe('http://127.0.0.1:9000/v1/audio/transcriptions');
    configurePushToTalk({ whisperUrl: 'http://127.0.0.1:8178/v1/audio/transcriptions' });
    expect(resolveWhisperEngine()).toBe('sidecar');
  });

  it('uses WASM only when the engine is forced', () => {
    configurePushToTalk({ engine: 'wasm' });
    expect(resolveWhisperEngine()).toBe('wasm');
  });
});

describe('resolveSidecarFilesUrl', () => {
  it('defaults to loopback /files on the same Tauri-stable origin', () => {
    expect(DEFAULT_WHISPER_FILES_PATH).toBe('/files');
    expect(resolveSidecarFilesUrl(DEFAULT_WHISPER_URL)).toBe(DEFAULT_WHISPER_FILES_URL);
    expect(resolveSidecarFilesUrl('http://127.0.0.1:8178/v1/audio/transcriptions')).toBe(
      'http://127.0.0.1:8178/files',
    );
    expect(resolveSidecarFilesUrl(`${DOGFOOD_WHISPER_TUNNEL_ORIGIN}/transcribe`)).toBe(
      `${DOGFOOD_WHISPER_TUNNEL_ORIGIN}/files`,
    );
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

  it('inserts a sidecar file ref without claiming hosted disk access', () => {
    expect(insertLocalFileRef('', 'hero.png')).toBe('[local file: hero.png]');
    expect(insertLocalFileRef('Look at', 'C:\\\\Users\\\\rev\\\\shot.jpg')).toBe(
      'Look at [local file: shot.jpg]',
    );
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
  it('uses the localhost sidecar by default', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'From the laptop sidecar' }),
    });
    const wasm = vi.fn(async () => ({ ok: true, text: 'From WASM' }));
    const result = await transcribeVoice(new Blob(['x']), { fetch: fetchImpl, wasm });
    expect(result).toEqual({ ok: true, text: 'From the laptop sidecar' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url] = fetchImpl.mock.calls[0] as [string];
    expect(url).toBe(DEFAULT_WHISPER_URL);
    expect(wasm).not.toHaveBeenCalled();
  });

  it('uses WASM only when the engine is forced', async () => {
    configurePushToTalk({ engine: 'wasm' });
    const result = await transcribeVoice(new Blob(['x']), {
      wasm: async () => ({ ok: true, text: 'From the phone' }),
    });
    expect(result).toEqual({ ok: true, text: 'From the phone' });
  });
});

describe('sidecar files', () => {
  it('lists files from GET /files', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        files: [{ id: '1', name: 'hero.png', mime: 'image/png', href: '/files/1' }],
      }),
    });
    const result = await listSidecarFiles({ fetch: fetchImpl, url: DEFAULT_WHISPER_FILES_URL });
    expect(result).toEqual({
      ok: true,
      files: [{ id: '1', name: 'hero.png', mime: 'image/png', href: '/files/1' }],
    });
    expect(fetchImpl).toHaveBeenCalledWith(DEFAULT_WHISPER_FILES_URL, expect.anything());
  });

  it('POSTs a blob to /files and returns the sidecar ref', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'abc',
        name: 'shot.jpg',
        mime: 'image/jpeg',
        href: '/files/abc',
      }),
    });
    const result = await uploadSidecarFile(new File(['img'], 'shot.jpg', { type: 'image/jpeg' }), {
      fetch: fetchImpl,
      url: DEFAULT_WHISPER_FILES_URL,
    });
    expect(result).toEqual({
      ok: true,
      file: { id: 'abc', name: 'shot.jpg', mime: 'image/jpeg', href: '/files/abc' },
    });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(DEFAULT_WHISPER_FILES_URL);
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
  });

  it('fail-closes when the sidecar files endpoint is down', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const result = await uploadSidecarFile(new File(['x'], 'a.png'), {
      fetch: fetchImpl,
      url: DEFAULT_WHISPER_FILES_URL,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('sidecar-unavailable');
    expect(result.message).toBe(LOCAL_SIDECAR_FILES_FAIL_CLOSED_MESSAGE);
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
