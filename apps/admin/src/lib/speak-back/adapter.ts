/**
 * Studio-owned speech adapter. The model vendor is not the product —
 * swap browser speech or a local TTS client without locking to a cloud vendor.
 */

export interface SpeechUtteranceLike {
  text: string;
}

export interface SpeechSynthesisLike {
  speak(utterance: SpeechUtteranceLike): void;
  cancel(): void;
}

export interface LocalTtsClient {
  speak(text: string): Promise<void> | void;
  cancel?(): void;
}

export interface SpeechAdapter {
  readonly id: string;
  speak(text: string): Promise<void> | void;
  cancel?(): void;
}

export function createWebSpeechAdapter(
  synthesis?: SpeechSynthesisLike | null,
  createUtterance: (text: string) => SpeechUtteranceLike = (text) => ({ text }),
): SpeechAdapter {
  return {
    id: 'web-speech',
    speak(text: string): void {
      if (!synthesis) return;
      synthesis.speak(createUtterance(text));
    },
    cancel(): void {
      synthesis?.cancel();
    },
  };
}

export function createLocalTtsAdapter(client: LocalTtsClient): SpeechAdapter {
  return {
    id: 'local-tts',
    speak(text: string): Promise<void> | void {
      return client.speak(text);
    },
    cancel(): void {
      client.cancel?.();
    },
  };
}

function readBrowserSpeechSynthesis(): SpeechSynthesisLike | null {
  if (typeof globalThis === 'undefined') return null;
  const speech = (globalThis as { speechSynthesis?: SpeechSynthesisLike }).speechSynthesis;
  return speech ?? null;
}

function createBrowserUtterance(text: string): SpeechUtteranceLike {
  const ctor = (
    globalThis as { SpeechSynthesisUtterance?: new (value: string) => SpeechUtteranceLike }
  ).SpeechSynthesisUtterance;
  if (ctor) return new ctor(text);
  return { text };
}

/** Default: browser speech. Pass a local TTS adapter to swap. */
export function resolveSpeechAdapter(override?: SpeechAdapter): SpeechAdapter {
  if (override) return override;
  return createWebSpeechAdapter(readBrowserSpeechSynthesis(), createBrowserUtterance);
}
