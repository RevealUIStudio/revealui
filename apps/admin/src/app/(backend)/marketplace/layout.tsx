import type { ReactElement, ReactNode } from 'react';
import { MarketplacePreviewBanner } from '@/lib/components/marketplace/MarketplacePreviewBanner';

export default function MarketplaceLayout({ children }: { children: ReactNode }): ReactElement {
  return (
    <>
      <MarketplacePreviewBanner />
      {children}
    </>
  );
}
