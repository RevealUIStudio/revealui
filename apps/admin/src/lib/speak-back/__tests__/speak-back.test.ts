import { afterEach, describe, expect, it } from 'vitest';
import {
  configureSpeakBack,
  createLocalTtsAdapter,
  createWebSpeechAdapter,
  readSpeakBackEnabled,
  requestSpeakBack,
  resetSpeakBackConfig,
  resolveSpeechAdapter,
  writeSpeakBackEnabled,
} from '../index';

function recordingAdapter(): {
  id: string;
  spoken: string[];
  speak: (text: string) => void;
} {
  const spoken: string[] = [];
  return {
    id: 'test',
    spoken,
    speak(text: string) {
      spoken.push(text);
    },
  };
}

afterEach(() => {
  resetSpeakBackConfig();
});

describe('requestSpeakBack', () => {
  it('invokes the adapter with the finished reply text when enabled', () => {
    const adapter = recordingAdapter();

    const result = requestSpeakBack({ text: 'Three posts are published.', enabled: true }, adapter);

    expect(result.spoken).toBe(true);
    expect(result.reason).toBe('spoken');
    expect(adapter.spoken).toEqual(['Three posts are published.']);
  });

  it('does not speak when speak-back is off', () => {
    const adapter = recordingAdapter();

    const result = requestSpeakBack({ text: 'Hello from the agent.', enabled: false }, adapter);

    expect(result.spoken).toBe(false);
    expect(result.reason).toBe('disabled');
    expect(adapter.spoken).toEqual([]);
  });

  it('does not speak secret-shaped API keys', () => {
    const adapter = recordingAdapter();

    const result = requestSpeakBack(
      {
        text: 'Use this key: sk-proj-abcdefghijklmnopqrstuvwxyz0123456789ABCDEF',
        enabled: true,
      },
      adapter,
    );

    expect(result.spoken).toBe(false);
    expect(result.reason).toBe('secret');
    expect(adapter.spoken).toEqual([]);
  });

  it('does not speak JWT license keys or bearer tokens', () => {
    const adapter = recordingAdapter();
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc123def456ghi789';

    const license = requestSpeakBack({ text: `Your license: ${jwt}`, enabled: true }, adapter);
    const bearer = requestSpeakBack(
      { text: 'Authorization: Bearer abcdef0123456789abcdef0123456789', enabled: true },
      adapter,
    );

    expect(license.reason).toBe('secret');
    expect(bearer.reason).toBe('secret');
    expect(adapter.spoken).toEqual([]);
  });

  it('does not speak RevealUI license-key tokens', () => {
    const adapter = recordingAdapter();

    const result = requestSpeakBack(
      { text: 'Founder key RVUI-pro-0123456789abcdef0123456789abcdef', enabled: true },
      adapter,
    );

    expect(result.spoken).toBe(false);
    expect(result.reason).toBe('secret');
    expect(adapter.spoken).toEqual([]);
  });

  it('does not speak empty replies', () => {
    const adapter = recordingAdapter();

    const result = requestSpeakBack({ text: '   ', enabled: true }, adapter);

    expect(result.spoken).toBe(false);
    expect(result.reason).toBe('empty');
    expect(adapter.spoken).toEqual([]);
  });

  it('speaks the agent reply text itself, not a rewritten model pass', () => {
    const adapter = recordingAdapter();
    const reply = 'I created the draft and left it unpublished.';

    requestSpeakBack({ text: reply, enabled: true }, adapter);

    expect(adapter.spoken[0]).toBe(reply);
  });
});

describe('speech adapters', () => {
  it('web-speech adapter speaks through the injected synthesis surface', () => {
    const uttered: string[] = [];
    const adapter = createWebSpeechAdapter({
      speak(utterance) {
        uttered.push(utterance.text);
      },
      cancel() {},
    });

    expect(adapter.id).toBe('web-speech');
    adapter.speak('Reply ready.');
    expect(uttered).toEqual(['Reply ready.']);
  });

  it('local TTS adapter delegates to the studio-owned client', () => {
    const uttered: string[] = [];
    const adapter = createLocalTtsAdapter({
      speak(text) {
        uttered.push(text);
      },
    });

    expect(adapter.id).toBe('local-tts');
    adapter.speak('Local voice.');
    expect(uttered).toEqual(['Local voice.']);
  });

  it('resolveSpeechAdapter prefers an explicit override over the default', () => {
    const local = createLocalTtsAdapter({ speak() {} });
    expect(resolveSpeechAdapter(local).id).toBe('local-tts');
  });

  it('configureSpeakBack is overridable and defaults to off', () => {
    expect(resetSpeakBackConfig).toBeTypeOf('function');
    configureSpeakBack({ defaultEnabled: true, preferenceKey: 'test.speak-back' });
    const adapter = recordingAdapter();
    // Policy still requires the caller to pass enabled — config does not auto-enable.
    const result = requestSpeakBack({ text: 'Hi', enabled: false }, adapter);
    expect(result.reason).toBe('disabled');
  });
});

describe('speak-back preference', () => {
  afterEach(() => {
    localStorage.clear();
    resetSpeakBackConfig();
  });

  it('is off until the owner stores on', () => {
    expect(readSpeakBackEnabled()).toBe(false);
    writeSpeakBackEnabled(true);
    expect(readSpeakBackEnabled()).toBe(true);
    writeSpeakBackEnabled(false);
    expect(readSpeakBackEnabled()).toBe(false);
  });
});
