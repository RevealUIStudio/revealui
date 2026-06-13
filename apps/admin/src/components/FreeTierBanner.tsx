'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useLicense } from '@/lib/providers/LicenseProvider';

const DISMISS_KEY = 'rvui-free-tier-dismissed';

export function FreeTierBanner() {
  const { tier, isLoading } = useLicense();
  // Start dismissed=true to avoid a hydration flash on the server render.
  // useEffect corrects it client-side after sessionStorage is available.
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === '1');
  }, []);

  const handleDismiss = useCallback(() => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  }, []);

  if (isLoading || dismissed || tier !== 'free') return null;

  return (
    <div className="mb-4 flex items-center justify-between gap-x-6 rounded-lg bg-primary px-5 py-2.5 text-sm text-primary-foreground">
      <p>
        You&apos;re on the <span className="font-semibold">Free plan</span> &mdash; 3 users and
        1,000 agent tasks/month.{' '}
        <Link
          href="/account/billing?upgrade=pro"
          className="font-semibold underline underline-offset-2 hover:opacity-80"
        >
          Start your 7-day Pro trial &rarr;
        </Link>
      </p>
      <button
        type="button"
        onClick={handleDismiss}
        className="-m-1.5 flex-none p-1.5 opacity-70 hover:opacity-100"
        aria-label="Dismiss"
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
        </svg>
      </button>
    </div>
  );
}
