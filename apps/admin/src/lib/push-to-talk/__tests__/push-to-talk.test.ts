import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  configurePushToTalk,
  DEFAULT_WHISPER_ORIGIN,
  DEFAULT_WHISPER_URL,
  insertTranscript,
  isAllowedWhisperEndpoint,
  isLoopbackHostname,
  LOCAL_WHISPER_FAIL_CLOSED_MESSAGE,
  readWhisperUrlFromEnv,
  resetPushToTalkConfig,
  resolveWhisperUrl,
  transcribeLocalWhisper,
  whisperConnectSrcOrigin,
} from '../index';

afterEach(() => {
  resetPushToTalkConfig();
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

  it('rejects public and LAN hosts', () => {
    expect(isLoopbackHostname('openai.com')).toBe(false);
    expect(isLoopbackHostname('api.openai.com')).toBe(false);
    expect(isLoopbackHostname('192.168.1.10')).toBe(false);
    expect(isLoopbackHostname('10.0.0.2')).toBe(false);
    expect(isLoopbackHostname('8.8.8.8')).toBe(false);
  });
});

describe('isAllowedWhisperEndpoint', () => {
  it('allows the default loopback OpenAI-compatible path', () => {
    expect(isAllowedWhisperEndpoint(DEFAULT_WHISPER_URL)).toBe(true);
    expect(isAllowedWhisperEndpoint('http://localhost:8178/v1/audio/transcriptions')).toBe(true);
    expect(isAllowedWhisperEndpoint('/api/stt')).toBe(true);
  });

  it('refuses cloud STT SaaS hosts even when WHISPER_URL is pointed at them', () => {
    expect(isAllowedWhisperEndpoint('https://api.openai.com/v1/audio/transcriptions')).toBe(false);
    expect(isAllowedWhisperEndpoint('https://api.assemblyai.com/v2/transcript')).toBe(false);
    expect(isAllowedWhisperEndpoint('https://api.deepgram.com/v1/listen')).toBe(false);
    expect(isAllowedWhisperEndpoint('https://speech.googleapis.com/v1/speech:recognize')).toBe(
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
  it('returns the loopback origin for CSP connect-src', () => {
    expect(whisperConnectSrcOrigin(DEFAULT_WHISPER_URL)).toBe(DEFAULT_WHISPER_ORIGIN);
    expect(whisperConnectSrcOrigin('http://localhost:9000/v1/audio/transcriptions')).toBe(
      'http://localhost:9000',
    );
  });

  it('never emits a cloud STT origin', () => {
    expect(whisperConnectSrcOrigin('https://api.openai.com/v1/audio/transcriptions')).toBe('');
  });
});

describe('resolveWhisperUrl', () => {
  it('defaults to loopback whisper small when env is unset', () => {
    expect(resolveWhisperUrl(undefined)).toBe(DEFAULT_WHISPER_URL);
    expect(resolveWhisperUrl('')).toBe(DEFAULT_WHISPER_URL);
    expect(readWhisperUrlFromEnv({})).toBe(DEFAULT_WHISPER_URL);
  });

  it('honors NEXT_PUBLIC_WHISPER_URL then WHISPER_URL', () => {
    expect(
      readWhisperUrlFromEnv({
        NEXT_PUBLIC_WHISPER_URL: 'http://127.0.0.1:9000/v1/audio/transcriptions',
      }),
    ).toBe('http://127.0.0.1:9000/v1/audio/transcriptions');
    expect(
      readWhisperUrlFromEnv({ WHISPER_URL: 'http://127.0.0.1:9001/v1/audio/transcriptions' }),
    ).toBe('http://127.0.0.1:9001/v1/audio/transcriptions');
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

describe('transcribeLocalWhisper', () => {
  it('POSTs audio to the local sidecar and returns text', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'Show me all published posts' }),
    });
    const audio = new Blob(['wav'], { type: 'audio/webm' });

    const result = await transcribeLocalWhisper(audio, { fetch: fetchImpl });

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
    const result = await transcribeLocalWhisper(new Blob(['x']), { fetch: fetchImpl });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('sidecar-unavailable');
    expect(result.message).toBe(LOCAL_WHISPER_FAIL_CLOSED_MESSAGE);
  });

  it('fail-closes on HTTP errors from the sidecar', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
    const result = await transcribeLocalWhisper(new Blob(['x']), { fetch: fetchImpl });

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
    const result = await transcribeLocalWhisper(new Blob([]), { fetch: fetchImpl });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('empty-audio');
  });
});
