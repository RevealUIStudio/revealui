import { useCallback, useState } from 'react';

const STORAGE_KEY = 'revealui-welcome-dismissed';

export default function WelcomeBanner() {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(STORAGE_KEY) === '1');

  const dismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, '1');
    setDismissed(true);
  }, []);

  if (dismissed) return null;

  return (
    <div className="relative rounded-lg border border-orange-800/40 bg-orange-950/30 px-5 py-4">
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-3 top-3 text-neutral-500 hover:text-neutral-300"
        aria-label="Dismiss welcome message"
      >
        <svg
          className="size-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
      <h2 className="text-sm font-semibold text-orange-200">Welcome to RevealUI Studio</h2>
      <p className="mt-1 text-xs leading-relaxed text-neutral-400">
        Your native AI experience for managing agents and infrastructure. Use the sidebar to
        navigate between services - check system status on the{' '}
        <strong className="text-neutral-300">Dashboard</strong>, manage secrets in the{' '}
        <strong className="text-neutral-300">Vault</strong>, and configure your environment in{' '}
        <strong className="text-neutral-300">Setup</strong>.
      </p>
    </div>
  );
}
