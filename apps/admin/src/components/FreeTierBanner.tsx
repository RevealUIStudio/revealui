'use client';

import { Button, IconClose } from '@revealui/presentation/server';
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
      <Button
        type="button"
        appearance="ghost"
        variant="neutral"
        size="icon"
        onClick={handleDismiss}
        className="-m-1.5 size-8 shrink-0 text-primary-foreground opacity-70 hover:bg-primary-foreground/10 hover:opacity-100"
        aria-label="Dismiss"
      >
        <IconClose size="sm" />
      </Button>
    </div>
  );
}
