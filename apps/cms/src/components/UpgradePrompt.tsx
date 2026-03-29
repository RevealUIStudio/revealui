'use client';

import {
  FEATURE_LABELS,
  getTiersFromCurrent,
  type LicenseTierId,
  TIER_LABELS,
} from '@revealui/contracts/pricing';
import type { FeatureFlags } from '@revealui/core/features';
import { getRequiredTier } from '@revealui/core/features';
import {
  ButtonCVA as Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PricingTable,
} from '@revealui/presentation/server';
import Link from 'next/link';
import { useLicense } from '@/lib/providers/LicenseProvider';

interface UpgradePromptProps {
  feature: keyof FeatureFlags;
  description?: string;
  /** 'sampling' renders a softer banner for free-tier AI quota exhaustion */
  variant?: 'default' | 'sampling';
}

export function UpgradePrompt({ feature, description, variant = 'default' }: UpgradePromptProps) {
  const { tier: currentTier } = useLicense();
  const label = FEATURE_LABELS[feature];
  const requiredTier = getRequiredTier(feature);
  const tierLabel = requiredTier === 'free' ? 'Pro' : TIER_LABELS[requiredTier as LicenseTierId];
  const upgradeHref = `/account/billing?upgrade=${requiredTier === 'free' ? 'pro' : requiredTier}`;
  const upgradeTiers = getTiersFromCurrent(currentTier);

  if (variant === 'sampling') {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-800 dark:bg-blue-950/30">
        <div className="flex-1 text-sm text-blue-700 dark:text-blue-300">
          {description ||
            'Free AI sampling quota reached. Upgrade to Pro for 10,000 tasks/month with full coding tools.'}
        </div>
        <Link href={upgradeHref}>
          <Button variant="outline" size="sm" className="shrink-0">
            Upgrade to Pro
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-base">{label}</CardTitle>
        <CardDescription>
          {description || `This feature requires a ${tierLabel} license.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Link href={upgradeHref}>
          <Button variant="outline" size="sm">
            Upgrade to {tierLabel}
          </Button>
        </Link>

        {upgradeTiers.length > 0 && (
          <div className="pt-2 border-t dark:border-zinc-800">
            <p className="mb-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Compare plans
            </p>
            <PricingTable
              tiers={upgradeTiers}
              currentTier={currentTier ?? 'free'}
              compact
              onSelectTier={(id) => {
                window.location.href = `/account/billing?upgrade=${id}`;
              }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
