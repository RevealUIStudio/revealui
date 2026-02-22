'use client'

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
  feature: string
  description?: string
}

const featureLabels: Record<string, string> = {
  ai: 'AI Agents',
  aiMemory: 'AI Memory',
  mcp: 'MCP Server Integration',
  editors: 'Editor Integration',
  payments: 'Built-in Payments',
  advancedSync: 'Advanced Real-time Sync',
  dashboard: 'Monitoring Dashboard',
  customDomain: 'Custom Domains',
  analytics: 'Analytics',
  multiTenant: 'Multi-tenant Management',
  whiteLabel: 'White-label Branding',
  sso: 'SSO/SAML Authentication',
  auditLog: 'Audit Logging',
}

export function UpgradePrompt({ feature, description }: UpgradePromptProps) {
  const label = featureLabels[feature] || feature

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-base">{label}</CardTitle>
        <CardDescription>
          {description || `This feature requires a Pro or Enterprise license.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Link href="/account/billing">
          <Button variant="outline" size="sm">
            Upgrade to Pro
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}
