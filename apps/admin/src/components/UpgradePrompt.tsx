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
import { hasCommercialUpgradePath } from '@/lib/components/should-show-upgrade-nav';
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
  const canBuy = hasCommercialUpgradePath(currentTier);

  if (variant === 'sampling') {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3">
        <div className="flex-1 text-sm text-primary">
          {description ||
            (canBuy
              ? 'Free AI sampling quota reached. Upgrade to Pro for 10,000 tasks/month with full coding tools.'
              : 'AI sampling quota is exhausted on this account. Ask an operator to raise the grant. There is no buy path above this tier.')}
        </div>
        {canBuy ? (
          <Link href={upgradeHref}>
            <Button appearance="outline" variant="neutral" size="sm" className="shrink-0">
              Upgrade to Pro
            </Button>
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-base">{label}</CardTitle>
        <CardDescription>
          {description ||
            (canBuy
              ? `This feature requires a ${tierLabel} license.`
              : 'This account is already on the highest commercial tier. Ask an operator to grant the feature. There is no founder bypass.')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {canBuy ? (
          <Link href={upgradeHref}>
            <Button appearance="outline" variant="neutral" size="sm">
              Upgrade to {tierLabel}
            </Button>
          </Link>
        ) : null}

        {canBuy && upgradeTiers.length > 0 ? (
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
        ) : null}
      </CardContent>
    </Card>
  );
}
