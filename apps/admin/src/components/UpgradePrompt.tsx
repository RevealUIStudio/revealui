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
  Button,
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
      <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3">
        <div className="flex-1 text-sm text-primary">
          {description ||
            'Free AI sampling quota reached. Upgrade to Pro for 10,000 tasks/month with full coding tools.'}
        </div>
        <Link href={upgradeHref}>
          <Button appearance="outline" variant="neutral" size="sm" className="shrink-0">
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
          <Button appearance="outline" variant="neutral" size="sm">
            Upgrade to {tierLabel}
          </Button>
        </Link>

        {upgradeTiers.length > 0 && (
          <div className="pt-2 border-t border-border">
            <p className="mb-3 text-xs font-medium text-muted-foreground">Compare plans</p>
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
