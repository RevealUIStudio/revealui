'use client';

import { useCallback, useMemo, useState } from 'react';
import { resolveSpeechAdapter, type SpeechAdapter } from './adapter';
import { requestSpeakBack, type SpeakBackResult } from './policy';
import { readSpeakBackEnabled, writeSpeakBackEnabled } from './preference';

export interface UseSpeakBackResult {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  speakReply: (text: string, options?: { force?: boolean }) => SpeakBackResult;
}

export function useSpeakBack(adapterOverride?: SpeechAdapter): UseSpeakBackResult {
  const [enabled, setEnabledState] = useState(() => {
    if (typeof window === 'undefined') return false;
    return readSpeakBackEnabled();
  });
  const adapter = useMemo(() => resolveSpeechAdapter(adapterOverride), [adapterOverride]);

  const setEnabled = useCallback(
    (next: boolean) => {
      setEnabledState(next);
      writeSpeakBackEnabled(next);
      if (!next) adapter.cancel?.();
    },
    [adapter],
  );

  const speakReply = useCallback(
    (text: string, options?: { force?: boolean }): SpeakBackResult => {
      return requestSpeakBack({ text, enabled: options?.force === true ? true : enabled }, adapter);
    },
    [adapter, enabled],
  );

  return useMemo(() => ({ enabled, setEnabled, speakReply }), [enabled, setEnabled, speakReply]);
}
