'use client';

import { useRouter } from 'next/navigation';
import React from 'react';

// RevealUI LivePreview component for real-time content updates
interface RevealUILivePreviewProps {
  refresh: () => void;
  serverURL: string;
}

const RevealUILivePreview = ({ refresh, serverURL }: RevealUILivePreviewProps) => {
  // Listen for live preview messages from parent window
  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Verify origin matches server URL
      if (event.origin !== serverURL) return;

      if (event.data?.type === 'revealui-live-preview') {
        refresh();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [refresh, serverURL]);

  return null;
};

export const LivePreviewListener = () => {
  const router = useRouter();
  const serverURL = process.env.NEXT_PUBLIC_SERVER_URL ?? '';

  return <RevealUILivePreview refresh={router.refresh} serverURL={serverURL} />;
};
