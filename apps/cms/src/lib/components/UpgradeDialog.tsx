'use client';

import { getTiersFromCurrent } from '@revealui/contracts/pricing';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@revealui/presentation';
import { PricingTable } from '@revealui/presentation/server';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useLicense } from '@/lib/providers/LicenseProvider';

/**
 * Global upgrade dialog that listens for `revealui:upgrade-required` custom events.
 * Shows tier comparison with direct checkout buttons.
 */
export function UpgradeDialog() {
  const [open, setOpen] = useState(false);
  const [featureName, setFeatureName] = useState<string | undefined>();
  const { tier } = useLicense();

  useEffect(() => {
    function handleUpgradeRequired(e: Event) {
      const detail = (e as CustomEvent<{ feature?: string }>).detail;
      setFeatureName(detail?.feature);
      setOpen(true);
    }

    window.addEventListener('revealui:upgrade-required', handleUpgradeRequired);
    return () => window.removeEventListener('revealui:upgrade-required', handleUpgradeRequired);
  }, []);

  const handleClose = useCallback(() => setOpen(false), []);

  const handleSelectTier = useCallback(async (tierId: string) => {
    try {
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'https://api.revealui.com').trim();
      const res = await fetch(`${apiUrl}/api/billing/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          priceId:
            tierId === 'pro'
              ? process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID
              : tierId === 'max'
                ? process.env.NEXT_PUBLIC_STRIPE_MAX_PRICE_ID
                : process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID,
          tier: tierId,
        }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      // Fall back to billing page
      window.location.href = `/account/billing?upgrade=${tierId}`;
    }
  }, []);

  const upgradeTiers = getTiersFromCurrent(tier);

  return (
    <Dialog open={open} onClose={handleClose} size="2xl">
      <DialogTitle>Upgrade Your Plan</DialogTitle>
      <DialogDescription>
        {featureName
          ? `"${featureName}" requires a higher tier. Choose a plan to unlock it.`
          : 'Unlock more features by upgrading your plan.'}
      </DialogDescription>
      <DialogBody>
        <PricingTable
          tiers={upgradeTiers}
          currentTier={tier ?? 'free'}
          compact
          onSelectTier={(id) => void handleSelectTier(id)}
        />
      </DialogBody>
      <DialogActions>
        <Link
          href="/admin/upgrade"
          className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
          onClick={handleClose}
        >
          View full pricing
        </Link>
        <button
          type="button"
          onClick={handleClose}
          className="rounded-md px-3 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          Maybe later
        </button>
      </DialogActions>
    </Dialog>
  );
}
