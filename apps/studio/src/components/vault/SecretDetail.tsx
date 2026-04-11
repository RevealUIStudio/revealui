import { useState } from 'react';
import { vaultCopy } from '../../lib/invoke';

const COPY_FEEDBACK_MS = 2_000;

import Button from '../ui/Button';

interface SecretDetailProps {
  path: string | null;
  value: string | null;
  loading: boolean;
}

export default function SecretDetail({ path, value, loading }: SecretDetailProps) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!value) return;
    try {
      await vaultCopy(value);
      setCopied(true);
      setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    } catch {
      // clipboard unavailable
    }
  };

  if (!path) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-neutral-500">
        Select a secret to view its value
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">Path</p>
        <p className="mt-1 break-all font-mono text-sm text-neutral-200">{path}</p>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">Value</p>
        {loading ? (
          <div className="mt-1 h-16 animate-pulse rounded-md bg-neutral-800/50" />
        ) : (
          <div className="mt-1 rounded-md border border-neutral-800 bg-neutral-950/50 p-3">
            <pre
              className={`break-all font-mono text-sm text-neutral-200 ${
                revealed ? '' : 'select-none blur-sm'
              }`}
            >
              {value ?? ' - '}
            </pre>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => setRevealed((r) => !r)}>
          {revealed ? 'Hide' : 'Reveal'}
        </Button>
        <Button variant="secondary" onClick={handleCopy} disabled={!value || loading}>
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      </div>
    </div>
  );
}
