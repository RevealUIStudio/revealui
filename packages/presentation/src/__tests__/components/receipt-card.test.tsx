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

  it('renders no animation classes, vars, or style tag when animate is unset', () => {
    const { container } = render(
      <ReceiptCard
        title="Static"
        lines={lines}
        integrity={{ kind: 'sha256', value: 'a1b2c3d4' }}
      />,
    );
    const items = screen.getAllByRole('listitem');
    for (const item of items) {
      expect(item.className).toBe('');
      expect(item.getAttribute('style')).toBeNull();
    }
    const footer = container.querySelector('footer');
    expect(footer?.className).not.toMatch(/rvui-receipt-print/);
    expect(container.querySelector('style')).toBeNull();
  });

  it('stamps the per-row print delay custom property and renders all lines at first render when animate="print"', () => {
    const { container } = render(
      <ReceiptCard
        title="Printing"
        lines={lines}
        integrity={{ kind: 'sha256', value: 'a1b2c3d4' }}
        animate="print"
      />,
    );

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(lines.length);
    items.forEach((item, i) => {
      expect(item.className).toContain('rvui-receipt-print-line');
      expect(item.style.getPropertyValue('--rvui-print-i')).toBe(String(i));
    });

    // All ledger content is present immediately  -  no waiting on the animation.
    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText('agent-system')).toBeInTheDocument();
    expect(screen.getByText('sha256')).toBeInTheDocument();

    const footer = container.querySelector('footer');
    expect(footer?.className).toContain('rvui-receipt-print-seal');
    expect(footer?.style.getPropertyValue('--rvui-print-i')).toBe(String(lines.length));

    expect(container.querySelector('style')?.textContent).toContain('rvui-receipt-print');
  });
});
