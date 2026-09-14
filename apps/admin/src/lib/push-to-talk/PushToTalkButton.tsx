'use client';

import { Button } from '@revealui/presentation';
import { type JSX, useCallback, useRef } from 'react';
import { type PushToTalkDependencies, usePushToTalk } from './use-push-to-talk';

export interface PushToTalkButtonProps {
  disabled?: boolean;
  onTranscript: (text: string) => void;
  deps?: PushToTalkDependencies;
}

function statusLabel(status: string, disabled: boolean): string {
  if (disabled) return 'Hold to talk';
  if (status === 'recording') return 'Listening… release to insert';
  if (status === 'transcribing') return 'Transcribing locally…';
  return 'Hold to talk';
}

export function PushToTalkButton({
  disabled = false,
  onTranscript,
  deps,
}: PushToTalkButtonProps): JSX.Element {
  const ptt = usePushToTalk(deps);
  const finishingRef = useRef(false);

  const finish = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    try {
      const text = await ptt.endHold();
      if (text) onTranscript(text);
    } finally {
      finishingRef.current = false;
    }
  }, [onTranscript, ptt]);

  const begin = useCallback(() => {
    if (disabled || ptt.status === 'transcribing') return;
    finishingRef.current = false;
    void ptt.startHold();
  }, [disabled, ptt]);

  const label = statusLabel(ptt.status, disabled);

  return (
    <div className="flex w-full min-w-0 flex-col items-stretch gap-1">
      <Button
        type="button"
        appearance={ptt.isRecording ? 'solid' : 'outline'}
        variant={ptt.status === 'error' ? 'danger' : ptt.isRecording ? 'brand' : 'neutral'}
        disabled={disabled || ptt.status === 'transcribing'}
        aria-label={label}
        aria-pressed={ptt.isRecording}
        className="h-14 w-full min-h-14 shrink-0 select-none rounded-xl px-4 text-base font-medium touch-manipulation touch-none sm:h-12 sm:min-h-12 sm:text-sm"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture?.(event.pointerId);
          begin();
        }}
        onPointerUp={() => {
          void finish();
        }}
        onPointerCancel={() => {
          void finish();
        }}
        onKeyDown={(event) => {
          if (event.key !== ' ' && event.key !== 'Enter') return;
          event.preventDefault();
          if (!event.repeat) begin();
        }}
        onKeyUp={(event) => {
          if (event.key !== ' ' && event.key !== 'Enter') return;
          event.preventDefault();
          void finish();
        }}
      >
        {label}
      </Button>
      {ptt.errorMessage ? (
        <p role="alert" className="text-xs text-error">
          {ptt.errorMessage}
        </p>
      ) : null}
    </div>
  );
}
