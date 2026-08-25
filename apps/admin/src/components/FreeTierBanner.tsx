'use client';

import { Button, IconClose } from '@revealui/presentation/server';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useLicense } from '@/lib/providers/LicenseProvider';

const DISMISS_KEY = 'rvui-free-tier-dismissed';

interface FreeTierBannerProps {
  /**
   * True on the hosted SaaS deployment, false on self-host (the unlicensed
   * Forge/template shape). Resolved server-side via `isHostedDeployment()`
   * and prop-drilled down, the same pattern used for `isFleetMode` — a
   * `NEXT_PUBLIC_*` env would get inlined at framework build time and miss
   * the value stamped into a self-host deploy at runtime.
   */
  isHosted: boolean;
}

export function FreeTierBanner({ isHosted }: FreeTierBannerProps) {
  const { tier, isLoading, resolveError } = useLicense();
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

  // GAP-454: never claim Free when tier resolution failed (401 / network).
  // Only a successful resolve to free may show the money-adjacent banner.
  if (isLoading || dismissed || resolveError || tier !== 'free') return null;

  return (
    <div className="mb-4 flex items-center justify-between gap-x-6 rounded-lg bg-primary px-5 py-2.5 text-sm text-primary-foreground">
      <p>
        You&apos;re on the <span className="font-semibold">Free plan</span>. 3 users. Local AI
        (Ollama) is included.{' '}
        {isHosted ? (
          <Link
            href="/account/billing?upgrade=pro"
            className="font-semibold underline underline-offset-2 hover:opacity-80"
          >
            Start your 7-day Pro trial &rarr;
          </Link>
        ) : (
          <a
            href="https://revealui.com/pricing#agency-founding-kit"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold underline underline-offset-2 hover:opacity-80"
          >
            Unlock with a license or Agency Kit &rarr;
          </a>
        )}
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
