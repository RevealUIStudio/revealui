import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MARKETPLACE_PREVIEW_COPY, MarketplacePreviewBanner } from '../MarketplacePreviewBanner';

describe('MarketplacePreviewBanner', () => {
  it('soft-badges RevMarket as preview and does not claim execution is live', () => {
    render(<MarketplacePreviewBanner />);
    expect(screen.getByText('Preview')).toBeDefined();
    expect(screen.getByText(MARKETPLACE_PREVIEW_COPY)).toBeDefined();
    expect(screen.getByRole('status').textContent).not.toMatch(/is live/i);
  });
});
