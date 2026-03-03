import type React from 'react'

/**
 * PoweredByRevealUI — shown in the admin dashboard for Free/Pro tier.
 *
 * Enterprise customers with the `whiteLabel` feature can remove RevealUI branding.
 * We decode the license JWT payload server-side to check the tier without a full
 * license initialization cycle (no async, no external fetch).
 */

function isWhiteLabelEnterprise(): boolean {
  const key = process.env.REVEALUI_LICENSE_KEY
  if (!key) return false
  try {
    const parts = key.split('.')
    if (parts.length < 2) return false
    const payload = JSON.parse(Buffer.from(parts[1] ?? '', 'base64').toString('utf8')) as {
      tier?: string
      features?: Record<string, boolean>
    }
    // Enterprise tier automatically grants whiteLabel
    return payload.tier === 'enterprise' || payload.features?.whiteLabel === true
  } catch {
    return false
  }
}

const PoweredByRevealUI: React.FC = () => {
  if (isWhiteLabelEnterprise()) return null

  return (
    <p className="mt-6 text-xs text-gray-400">
      Built with{' '}
      <a
        href="https://revealui.com"
        target="_blank"
        rel="noopener noreferrer"
        className="text-gray-400 underline hover:text-gray-200"
      >
        RevealUI
      </a>
    </p>
  )
}

export default PoweredByRevealUI
