import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';
import { useLicenseKey } from '../hooks/useLicenseKey';

interface LicenseGateProps {
  children: ReactNode;
}

export function LicenseGate({ children }: LicenseGateProps) {
  const { isValid, isLoading, validate, clear, tier } = useLicenseKey();
  const [inputKey, setInputKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = inputKey.trim();
      if (!trimmed) return;

      setValidating(true);
      setError(null);

      const result = await validate(trimmed);

      if (!result.valid) {
        setError('Invalid or expired license key. Check your key and try again.');
      }

      setValidating(false);
    },
    [inputKey, validate],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 sm:p-16">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-current border-t-transparent opacity-40" />
          <p className="text-sm opacity-60">Checking license…</p>
        </div>
      </div>
    );
  }

  if (isValid) {
    return (
      <div>
        <div className="mb-4 flex items-center justify-between rounded-lg border border-current/10 bg-current/5 px-4 py-2 text-sm">
          <span>RevealUI Pro{tier === 'enterprise' ? ' Enterprise' : ''} - licensed</span>
          <button
            type="button"
            onClick={clear}
            className="opacity-50 transition-opacity hover:opacity-100"
          >
            Sign out
          </button>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8 sm:py-16">
      <div className="rounded-xl border border-current/10 p-4 sm:p-8">
        <div className="mb-6 text-center">
          <div className="mb-3 text-3xl">🔒</div>
          <h2 className="mb-2 text-xl font-semibold">Pro docs</h2>
          <p className="text-sm opacity-60">
            Enter your RevealUI Pro license key to access this documentation.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            value={inputKey}
            onChange={(e) => setInputKey(e.target.value)}
            placeholder="rlui_pro_..."
            className="w-full rounded-lg border border-current/20 bg-current/5 px-4 py-2 font-mono text-sm outline-none focus:border-current/40"
            disabled={validating}
            autoComplete="off"
            spellCheck={false}
          />

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={validating || !inputKey.trim()}
            className="w-full rounded-lg bg-current/10 px-4 py-2 text-sm font-medium transition-colors hover:bg-current/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {validating ? 'Verifying…' : 'Unlock Pro docs'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs opacity-50">
          Don&apos;t have a license?{' '}
          <a
            href="https://revealui.com/pricing"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            View pricing
          </a>
        </p>
      </div>
    </div>
  );
}
