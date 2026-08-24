import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { First24hUxReceiptCard } from '../first-24h-ux-receipt-card';

describe('First24hUxReceiptCard', () => {
  it('renders the report through presentation ReceiptCard, with Max on Max lines and no Merkle seal', () => {
    render(
      <First24hUxReceiptCard
        lines={[
          {
            ts: '2026-08-20T16:00:00.000Z',
            actor: 'agent:first-24h-ux',
            action: 'verify-billing-trial-callout',
            object: 'Max PASS — billing-trial-callout',
            refId: 'rcpt-max-billing',
          },
          {
            ts: '2026-08-20T16:00:00.000Z',
            actor: 'agent:first-24h-ux',
            action: 'verify-real-mailbox-delivery',
            object: 'n/a SKIP — real-mailbox-delivery',
            refId: 'rcpt-mailbox-skip',
          },
        ]}
      />,
    );

    expect(
      screen.getByRole('region', { name: 'First-24h Pro/Max UX — 2026-08-20' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Max PASS — billing-trial-callout')).toBeInTheDocument();
    expect(screen.queryByText('Your Pro trial')).toBeNull();
    expect(screen.queryByText('sha256')).toBeNull();
    expect(screen.queryByText('Merkle')).toBeNull();
    expect(screen.queryByText('auditLog')).toBeNull();
  });
});
