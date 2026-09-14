'use client';

import { Button, InputCVA } from '@revealui/presentation';
import { type ChangeEvent, type JSX, useCallback, useRef, useState } from 'react';
import { type SidecarFileRef, type SidecarUploadResult, uploadSidecarFile } from './files';

export interface AttachViaSidecarButtonProps {
  disabled?: boolean;
  onAttached: (file: SidecarFileRef) => void;
  upload?: (file: Blob) => Promise<SidecarUploadResult>;
}

export function AttachViaSidecarButton({
  disabled = false,
  onAttached,
  upload = uploadSidecarFile,
}: AttachViaSidecarButtonProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const onPick = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file || busy || disabled) return;
      setBusy(true);
      setErrorMessage(null);
      try {
        const result = await upload(file);
        if (!result.ok) {
          setErrorMessage(result.message);
          return;
        }
        onAttached(result.file);
      } finally {
        setBusy(false);
      }
    },
    [busy, disabled, onAttached, upload],
  );

  return (
    <div className="flex w-full min-w-0 flex-col items-stretch gap-1">
      <InputCVA
        ref={inputRef}
        type="file"
        className="hidden"
        disabled={disabled || busy}
        onChange={(event) => {
          void onPick(event);
        }}
      />
      <Button
        type="button"
        appearance="outline"
        variant={errorMessage ? 'danger' : 'neutral'}
        disabled={disabled || busy}
        aria-label={busy ? 'Attaching via sidecar…' : 'Attach via sidecar'}
        className="h-11 w-full shrink-0 rounded-xl px-4 text-sm font-medium touch-manipulation sm:h-10"
        onClick={() => {
          inputRef.current?.click();
        }}
      >
        {busy ? 'Attaching via sidecar…' : 'Attach via sidecar'}
      </Button>
      {errorMessage ? (
        <p role="alert" className="text-xs text-error">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
