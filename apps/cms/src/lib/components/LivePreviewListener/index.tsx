'use client'

import { useRouter } from 'next/navigation'
import React from 'react'

// Placeholder LivePreview component - TODO: Implement local alternative
interface PayloadLivePreviewProps {
  refresh: () => void
  serverURL: string
}

const PayloadLivePreview: React.FC<PayloadLivePreviewProps> = ({ refresh, serverURL }) => {
  // Listen for live preview messages from parent window
  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Verify origin matches server URL
      if (event.origin !== serverURL) return

      if (event.data?.type === 'payload-live-preview') {
        refresh()
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [refresh, serverURL])

  return null
}

export const LivePreviewListener: React.FC = () => {
  const router = useRouter()
  return (
    <PayloadLivePreview refresh={router.refresh} serverURL={process.env.NEXT_PUBLIC_SERVER_URL!} />
  )
}
