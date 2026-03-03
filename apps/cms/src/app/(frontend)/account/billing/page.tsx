'use client'

import { useSession } from '@revealui/auth/react'
import {
  ButtonCVA as Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@revealui/presentation/server'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

interface SubscriptionData {
  tier: 'free' | 'pro' | 'enterprise'
  status: string
  expiresAt: string | null
}

export default function BillingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const success = searchParams.get('success')
  const upgrade = searchParams.get('upgrade')
  const { data: session, isLoading: sessionLoading } = useSession()
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [upgradeSuccess, setUpgradeSuccess] = useState(false)

  const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'https://api.revealui.com').trim()

  const fetchSubscription = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/billing/subscription`, { credentials: 'include' })
      if (res.ok) {
        const data = (await res.json()) as SubscriptionData
        setSubscription(data)
      }
    } catch {
      setError('Failed to load subscription data')
    } finally {
      setIsLoading(false)
    }
  }, [apiUrl])

  useEffect(() => {
    if (!sessionLoading && session) {
      void fetchSubscription()
    } else if (!(sessionLoading || session)) {
      router.push('/login')
    }
  }, [session, sessionLoading, fetchSubscription, router])

  // Auto-redirect to checkout on signup with ?upgrade=pro
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — trigger once when subscription loads, not on every actionLoading/handleUpgrade change
  useEffect(() => {
    if (upgrade === 'pro' && subscription?.tier === 'free' && !actionLoading) {
      void handleCheckout()
    }
  }, [upgrade, subscription])

  const handleCheckout = async () => {
    setActionLoading(true)
    setError(null)
    try {
      const res = await fetch(`${apiUrl}/api/billing/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || '',
          tier: 'pro',
        }),
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.error || 'Failed to start checkout')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleUpgradeToEnterprise = async () => {
    setActionLoading(true)
    setError(null)
    try {
      const res = await fetch(`${apiUrl}/api/billing/upgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          priceId: process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID || '',
          targetTier: 'enterprise',
        }),
      })
      const data = (await res.json()) as { success?: boolean; error?: string }
      if (data.success) {
        setUpgradeSuccess(true)
        // Refresh subscription data — webhook syncs DB async, so poll briefly
        setTimeout(() => void fetchSubscription(), 2000)
      } else {
        setError(data.error || 'Failed to upgrade subscription')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleManageBilling = async () => {
    setActionLoading(true)
    setError(null)
    try {
      const res = await fetch(`${apiUrl}/api/billing/portal`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.error || 'Failed to open billing portal')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setActionLoading(false)
    }
  }

  if (sessionLoading || isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-zinc-500">Loading...</p>
      </div>
    )
  }

  const tierLabels: Record<string, string> = {
    free: 'Free (OSS)',
    pro: 'Pro',
    enterprise: 'Enterprise',
  }

  const tierColors: Record<string, string> = {
    free: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    pro: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    enterprise: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  }

  const tier = subscription?.tier || 'free'

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-12">
      <h1 className="text-2xl font-bold">Billing</h1>

      {success && (
        <div className="rounded-md bg-green-50 p-4 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
          Subscription activated! Your Pro features are now available.
        </div>
      )}

      {upgradeSuccess && (
        <div className="rounded-md bg-purple-50 p-4 text-sm text-purple-700 dark:bg-purple-900/20 dark:text-purple-400">
          Upgraded to Enterprise! Your plan will update within a few seconds.
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>Your account and subscription details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-500">Plan</span>
            <span className={`rounded-full px-3 py-1 text-sm font-medium ${tierColors[tier]}`}>
              {tierLabels[tier]}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-500">Status</span>
            <span className="text-sm font-medium capitalize">
              {subscription?.status || 'active'}
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

          <div className="border-t pt-4 dark:border-zinc-800">
            {tier === 'free' && (
              <div className="space-y-3">
                <p className="text-sm text-zinc-500">
                  Upgrade to Pro for AI agents, advanced sync, built-in payments, and more.
                </p>
                <Button onClick={handleCheckout} disabled={actionLoading} className="w-full">
                  {actionLoading ? 'Redirecting to checkout...' : 'Upgrade to Pro — $49/mo'}
                </Button>
                <p className="text-center text-xs text-zinc-400">Includes a 7-day free trial</p>
              </div>
            )}

            {tier === 'pro' && (
              <div className="space-y-3">
                <p className="text-sm text-zinc-500">
                  Upgrade to Enterprise for unlimited sites, multi-provider AI, white-label
                  branding, and dedicated support.
                </p>
                <Button
                  onClick={handleUpgradeToEnterprise}
                  disabled={actionLoading || upgradeSuccess}
                  className="w-full"
                >
                  {actionLoading
                    ? 'Upgrading...'
                    : upgradeSuccess
                      ? 'Upgraded to Enterprise'
                      : 'Upgrade to Enterprise — $299/mo'}
                </Button>
                <Button
                  onClick={handleManageBilling}
                  disabled={actionLoading}
                  variant="outline"
                  className="w-full"
                >
                  {actionLoading ? 'Opening portal...' : 'Manage Billing'}
                </Button>
              </div>
            )}

            {tier === 'enterprise' && (
              <Button
                onClick={handleManageBilling}
                disabled={actionLoading}
                variant="outline"
                className="w-full"
              >
                {actionLoading ? 'Opening portal...' : 'Manage Billing'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {tier === 'free' && (
        <Card>
          <CardHeader>
            <CardTitle>What&apos;s Included in Pro</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <li>Up to 5 sites and 25 users</li>
              <li>AI agent system (1 provider)</li>
              <li>AI memory (working + episodic)</li>
              <li>Built-in Stripe payment processing</li>
              <li>Full real-time sync with conflict resolution</li>
              <li>Monitoring dashboard</li>
              <li>Custom domain mapping</li>
              <li>Analytics and conversion tracking</li>
              <li>Email support (48-hour SLA)</li>
            </ul>
          </CardContent>
        </Card>
      )}

      {tier === 'pro' && (
        <Card>
          <CardHeader>
            <CardTitle>What&apos;s Included in Enterprise</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <li>Unlimited sites and users</li>
              <li>All AI providers (Anthropic, OpenAI, Groq, Ollama)</li>
              <li>Full AI memory (semantic + procedural + episodic)</li>
              <li>White-label branding removal</li>
              <li>Domain-locked license enforcement</li>
              <li>Audit log for all license + tier events</li>
              <li>Priority support (4-hour SLA)</li>
              <li>Custom SLA and DPA available</li>
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
