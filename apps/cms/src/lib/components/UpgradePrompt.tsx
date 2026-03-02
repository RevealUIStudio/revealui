import {
  ButtonCVA as Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@revealui/presentation/server'
import Link from 'next/link'
import type React from 'react'

interface UpgradePromptProps {
  feature: string
  requiredTier?: 'pro' | 'enterprise'
  children?: React.ReactNode
}

export function UpgradePrompt({ feature, requiredTier = 'pro', children }: UpgradePromptProps) {
  const tierLabel = requiredTier === 'enterprise' ? 'Enterprise' : 'Pro'
  const upgradeHref = `/account/billing?upgrade=${requiredTier}`

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <LockIcon />
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{feature}</CardTitle>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              Requires {tierLabel}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-zinc-500">
          {children ??
            `${feature} is available on the ${tierLabel} plan. Upgrade to unlock this feature.`}
        </p>
        <Button asChild>
          <Link href={upgradeHref}>Upgrade to {tierLabel}</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

function LockIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-zinc-400"
      aria-hidden="true"
    >
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}
