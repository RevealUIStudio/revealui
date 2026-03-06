'use client'

import type { FeatureFlags } from '@revealui/core/features'
import { getRequiredTier } from '@revealui/core/features'
import {
  ButtonCVA as Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@revealui/presentation/server'
import Link from 'next/link'

interface UpgradePromptProps {
  feature: keyof FeatureFlags
  description?: string
}

const featureLabels: Record<keyof FeatureFlags, string> = {
  ai: 'AI Agents',
  aiMemory: 'AI Memory',
  mcp: 'MCP Server Integration',
  editors: 'Editor Integration',
  harnesses: 'AI Harness Integration',
  payments: 'Built-in Payments',
  advancedSync: 'Advanced Real-time Sync',
  dashboard: 'Monitoring Dashboard',
  customDomain: 'Custom Domains',
  analytics: 'Analytics',
  byokServerSide: 'BYOK Server-side Key Storage',
  aiMultiProvider: 'Multi-provider AI',
  auditLog: 'Audit Logging',
  multiTenant: 'Multi-tenant Management',
  whiteLabel: 'White-label Branding',
  sso: 'SSO/SAML Authentication',
}

const tierLabels: Record<'pro' | 'max' | 'enterprise', string> = {
  pro: 'Pro',
  max: 'Max',
  enterprise: 'Forge',
}

export function UpgradePrompt({ feature, description }: UpgradePromptProps) {
  const label = featureLabels[feature]
  const requiredTier = getRequiredTier(feature)
  const tierLabel = requiredTier === 'free' ? 'Pro' : tierLabels[requiredTier]
  const upgradeHref = `/account/billing?upgrade=${requiredTier === 'free' ? 'pro' : requiredTier}`

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-base">{label}</CardTitle>
        <CardDescription>
          {description || `This feature requires a ${tierLabel} license.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Link href={upgradeHref}>
          <Button variant="outline" size="sm">
            Upgrade to {tierLabel}
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}
