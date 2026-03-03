'use client'

import { useSession } from '@revealui/auth/react'
import type { FeatureFlags } from '@revealui/core/features'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@revealui/presentation/server'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

interface SubscriptionData {
  tier: 'free' | 'pro' | 'enterprise'
  status: string
  expiresAt: string | null
}

interface TierLimits {
  sites: number | null
  users: number | null
}

const TIER_LIMITS: Record<'free' | 'pro' | 'enterprise', TierLimits> = {
  free: { sites: 1, users: 3 },
  pro: { sites: 5, users: 25 },
  enterprise: { sites: null, users: null },
}

const FEATURE_LABELS: Record<keyof FeatureFlags, string> = {
  ai: 'AI Agent System',
  aiMemory: 'AI Memory',
  mcp: 'MCP Server Integration',
  editors: 'Editor Integration',
  harnesses: 'AI Harness Coordination',
  payments: 'Built-in Payments',
  multiTenant: 'Multi-tenant Sites',
  whiteLabel: 'White-label Dashboard',
  sso: 'SSO / SAML',
  auditLog: 'Audit Logging',
  advancedSync: 'Advanced Real-time Sync',
  dashboard: 'Monitoring Dashboard',
  customDomain: 'Custom Domain Mapping',
  analytics: 'Analytics & Tracking',
}

const TIER_LABELS: Record<string, string> = {
  free: 'Free (OSS)',
  pro: 'Pro',
  enterprise: 'Enterprise',
}

const TIER_COLORS: Record<string, string> = {
  free: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  pro: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  enterprise: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
}

export default function LicensePage() {
  const router = useRouter()
  const { data: session, isLoading: sessionLoading } = useSession()
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
  const [features, setFeatures] = useState<Record<string, FeatureFlags> | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'https://api.revealui.com').trim()

      const [subRes, featRes] = await Promise.all([
        fetch(`${apiUrl}/api/billing/subscription`, { credentials: 'include' }),
        fetch(`${apiUrl}/api/license/features`),
      ])

      if (subRes.ok) {
        const data = (await subRes.json()) as SubscriptionData
        setSubscription(data)
      }

      if (featRes.ok) {
        const data = (await featRes.json()) as Record<string, FeatureFlags>
        setFeatures(data)
      }
    } catch {
      setError('Failed to load license data')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!sessionLoading && session) {
      void fetchData()
    } else if (!(sessionLoading || session)) {
      router.push('/login')
    }
  }, [session, sessionLoading, fetchData, router])

  if (sessionLoading || isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-zinc-500">Loading...</p>
      </div>
    )
  }

  const tier = subscription?.tier ?? 'free'
  const limits = TIER_LIMITS[tier]
  const tierFeatures = features?.[tier]
  const canUpgrade = tier === 'free' || tier === 'pro'

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-12">
      <h1 className="text-2xl font-bold">License & Plan</h1>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Current plan */}
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>Your active license and subscription status.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-500">Plan</span>
            <span className={`rounded-full px-3 py-1 text-sm font-medium ${TIER_COLORS[tier]}`}>
              {TIER_LABELS[tier]}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-500">Status</span>
            <span className="text-sm font-medium capitalize">
              {subscription?.status ?? 'active'}
            </span>
          </div>
          {subscription?.expiresAt && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-500">Expires</span>
              <span className="text-sm">
                {new Date(subscription.expiresAt).toLocaleDateString()}
              </span>
            </div>
          )}
          {canUpgrade && (
            <div className="border-t pt-3 dark:border-zinc-800">
              <Link
                href="/account/billing"
                className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                {tier === 'free' ? 'Upgrade to Pro →' : 'Upgrade to Enterprise →'}
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resource limits */}
      <Card>
        <CardHeader>
          <CardTitle>Resource Limits</CardTitle>
          <CardDescription>Usage limits for your current plan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-500">Sites</span>
            <span className="text-sm font-medium">
              {limits.sites === null ? 'Unlimited' : limits.sites}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-500">Users per site</span>
            <span className="text-sm font-medium">
              {limits.users === null ? 'Unlimited' : limits.users}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Feature access matrix */}
      <Card>
        <CardHeader>
          <CardTitle>Feature Access</CardTitle>
          <CardDescription>Features enabled on your current plan.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {(Object.entries(FEATURE_LABELS) as [keyof FeatureFlags, string][]).map(
              ([key, label]) => {
                const enabled = tierFeatures?.[key] ?? false
                return (
                  <li key={key} className="flex items-center gap-3 text-sm">
                    {enabled ? (
                      <CheckIcon className="text-green-500" />
                    ) : (
                      <XIcon className="text-zinc-300 dark:text-zinc-600" />
                    )}
                    <span className={enabled ? '' : 'text-zinc-400'}>{label}</span>
                  </li>
                )
              },
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className ?? ''}`}
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className ?? ''}`}
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
