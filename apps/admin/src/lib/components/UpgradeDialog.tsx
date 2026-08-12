'use client';

import { getTiersFromCurrent } from '@revealui/contracts/pricing';
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@revealui/presentation/client';
import { PricingTable } from '@revealui/presentation/server';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useLicense } from '@/lib/providers/LicenseProvider';
import { apiFetch } from '@/lib/utils/csrf';
import { safeStripeRedirect } from '@/lib/utils/safe-stripe-redirect';

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

  const [error, setError] = useState<string | null>(null);

  const handleSelectTier = useCallback(async (tierId: string) => {
    setError(null);
    try {
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'https://api.revealui.com').trim();
      const priceIdMap: Record<string, string | undefined> = {
        pro: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID,
        max: process.env.NEXT_PUBLIC_STRIPE_MAX_PRICE_ID,
        enterprise: process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID,
      };
      const priceId = priceIdMap[tierId];
      const res = await apiFetch(`${apiUrl}/api/billing/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...(priceId && { priceId }),
          tier: tierId,
        }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        safeStripeRedirect(data.url);
      } else {
        setError(data.error || 'Failed to start checkout. Please try again.');
      }
    } catch {
      // Fall back to billing page
      window.location.href = `/account/billing?upgrade=${tierId}`;
    }
  }, []);

  const upgradeTiers = getTiersFromCurrent(tier);
  // Enterprise / top grant: no higher commercial plan — do not upsell empty tables.
  const atTopTier = upgradeTiers.length === 0;

  return (
    <Dialog open={open} onClose={handleClose} size="2xl">
      <DialogTitle>{atTopTier ? 'You are on the top plan' : 'Upgrade Your Plan'}</DialogTitle>
      <DialogDescription>
        {atTopTier
          ? 'Your account already has the highest commercial tier. No further upgrade is available.'
          : featureName
            ? `"${featureName}" requires a higher tier. Choose a plan to unlock it.`
            : 'Unlock more features by upgrading your plan.'}
      </DialogDescription>
      <DialogBody>
        {error && <div className="mb-4 rounded-md bg-error/10 p-3 text-sm text-error">{error}</div>}
        {!atTopTier && (
          <PricingTable
            tiers={upgradeTiers}
            currentTier={tier ?? 'free'}
            compact
            onSelectTier={(id) => void handleSelectTier(id)}
          />
        )}
      </DialogBody>
      <DialogActions>
        {!atTopTier && (
          <Link
            href="/upgrade"
            className="text-sm font-medium text-primary hover:underline"
            onClick={handleClose}
          >
            View full pricing
          </Link>
        )}
        <Button
          type="button"
          appearance="ghost"
          variant="neutral"
          onClick={handleClose}
          className="text-muted-foreground hover:text-foreground"
        >
          {atTopTier ? 'Close' : 'Maybe later'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
