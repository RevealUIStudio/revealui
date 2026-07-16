import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { AuditEvent } from '../../components/audit-line.js';
import { ReceiptCard } from '../../components/receipt-card.js';

const lines: AuditEvent[] = [
  { ts: '2026-07-16T14:01Z', actor: 'alice', action: 'opened', object: 'claim #42' },
  {
    ts: '2026-07-16T14:03Z',
    actor: 'agent-system',
    action: 'approved',
    object: 'claim #42',
    refId: 'rcpt_1',
  },
];

describe('ReceiptCard', () => {
  it('labels the receipt region with its title', () => {
    render(<ReceiptCard title="Claim #42 receipt" lines={lines} />);
    expect(screen.getByRole('region', { name: 'Claim #42 receipt' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Claim #42 receipt' })).toBeInTheDocument();
  });

  it('composes one AuditLine per event in a list', () => {
    render(<ReceiptCard title="Ledger" lines={lines} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0] as HTMLElement).getByText('alice')).toBeInTheDocument();
    expect(within(items[1] as HTMLElement).getByText('agent-system')).toBeInTheDocument();
  });

  it('renders an integrity footer with a copy affordance', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    });
    render(
      <ReceiptCard
        title="Sealed"
        lines={lines}
        integrity={{ kind: 'sha256', value: 'a1b2c3d4' }}
      />,
    );

    expect(screen.getByText('sha256')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copy integrity hash a1b2c3d4' }));
    expect(writeText).toHaveBeenCalledWith('a1b2c3d4');
  });

  it('omits the integrity footer when integrity is absent', () => {
    render(<ReceiptCard title="No seal" lines={lines} />);
    expect(screen.queryByText('sha256')).toBeNull();
  });
});
