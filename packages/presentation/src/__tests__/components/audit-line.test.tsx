import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { type AuditEvent, AuditLine } from '../../components/audit-line.js';

const event: AuditEvent = {
  ts: '2026-07-16T14:03Z',
  actor: 'agent-system',
  action: 'approved',
  object: 'PR #1904',
  refId: 'rcpt_8f21ac',
};

describe('AuditLine', () => {
  it('renders every field of the event', () => {
    render(<AuditLine event={event} />);
    expect(screen.getByText('2026-07-16T14:03Z')).toBeInTheDocument();
    expect(screen.getByText('agent-system')).toBeInTheDocument();
    expect(screen.getByText('approved')).toBeInTheDocument();
    expect(screen.getByText('PR #1904')).toBeInTheDocument();
  });

  it('renders the timestamp in a semantic time element with tabular-nums', () => {
    const { container } = render(<AuditLine event={event} />);
    const time = container.querySelector('time');
    expect(time).not.toBeNull();
    expect(time?.getAttribute('dateTime')).toBe('2026-07-16T14:03Z');
    expect(container.querySelector('.tabular-nums')).not.toBeNull();
  });

  it('copies the refId to the clipboard through an accessible affordance', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    });
    render(<AuditLine event={event} />);

    const button = screen.getByRole('button', { name: 'Copy reference rcpt_8f21ac' });
    await user.click(button);

    expect(writeText).toHaveBeenCalledWith('rcpt_8f21ac');
    expect(
      screen.getByRole('button', { name: 'Copied reference rcpt_8f21ac' }),
    ).toBeInTheDocument();
  });

  it('omits the copy affordance when there is no refId', () => {
    const { refId: _drop, ...noRef } = event;
    render(<AuditLine event={noRef} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
