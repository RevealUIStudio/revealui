import { Badge } from '@revealui/presentation';
import type React from 'react';

export const MARKETPLACE_PREVIEW_COPY =
  'RevMarket execution is preview-only. Agent skills are not run; sandbox stubs fail closed instead of faking success.';

export function MarketplacePreviewBanner(): React.ReactElement {
  return (
    <div className="border-b border-warning/30 bg-warning/10 px-6 py-3" role="status">
      <div className="flex items-start gap-2">
        <Badge intent="warning">Preview</Badge>
        <p className="text-sm text-muted-foreground">{MARKETPLACE_PREVIEW_COPY}</p>
      </div>
    </div>
  );
}
