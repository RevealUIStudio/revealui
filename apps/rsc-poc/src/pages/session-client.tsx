'use client';

import { Button } from '@revealui/presentation';
import { useState, useTransition } from 'react';
import { secretPing, whoami } from './session.server.ts';

export function WhoamiButton(): React.ReactNode {
  const [text, setText] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div>
      <Button
        type="button"
        disabled={pending}
        isLoading={pending}
        size="sm"
        onClick={() => {
          start(async () => {
            setText(await whoami());
          });
        }}
      >
        {pending ? '…' : 'whoami()'}
      </Button>
      {text !== null && (
        <pre data-whoami="" style={{ marginTop: 8 }}>
          {text}
        </pre>
      )}
    </div>
  );
}

export function SecretPingForm(): React.ReactNode {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div>
      <Button
        type="button"
        disabled={pending}
        isLoading={pending}
        size="sm"
        onClick={() => {
          start(async () => {
            setError(null);
            try {
              setText(await secretPing());
            } catch (e) {
              setText(null);
              setError(e instanceof Error ? e.message : String(e));
            }
          });
        }}
      >
        {pending ? '…' : 'secretPing()'}
      </Button>
      {text !== null && (
        <pre data-secret-ok="" style={{ marginTop: 8, color: '#166534' }}>
          {text}
        </pre>
      )}
      {error !== null && (
        <pre data-secret-err="" style={{ marginTop: 8, color: '#991b1b' }}>
          {error}
        </pre>
      )}
    </div>
  );
}
