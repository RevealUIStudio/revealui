'use client'

import {
  FEATURE_LABELS,
  getTiersFromCurrent,
  type LicenseTierId,
  TIER_LABELS,
} from '@revealui/contracts/pricing'
import type { FeatureFlags } from '@revealui/core/features'
import { getRequiredTier } from '@revealui/core/features'
import {
  ButtonCVA as Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PricingTable,
} from '@revealui/presentation/server'
import Link from 'next/link'
import { useLicense } from '@/lib/providers/LicenseProvider'

interface UpgradePromptProps {
  feature: keyof FeatureFlags
  description?: string
}

export function UpgradePrompt({ feature, description }: UpgradePromptProps) {
  const { tier: currentTier } = useLicense()
  const label = FEATURE_LABELS[feature]
  const requiredTier = getRequiredTier(feature)
  const tierLabel = requiredTier === 'free' ? 'Pro' : TIER_LABELS[requiredTier as LicenseTierId]
  const upgradeHref = `/account/billing?upgrade=${requiredTier === 'free' ? 'pro' : requiredTier}`
  const upgradeTiers = getTiersFromCurrent(currentTier)

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
                window.location.href = `/account/billing?upgrade=${id}`
              }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
