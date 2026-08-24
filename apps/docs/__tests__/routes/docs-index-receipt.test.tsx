/**
 * Docs landing static receipt motif (GAP-480 Phase D / frontend-excellence Phase 5).
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DocsIndexPage } from '../../app/routes/DocsIndexPage';

vi.mock('../../app/lib/head', () => ({
  applyDocHead: vi.fn(),
}));

vi.mock('../../app/utils/markdown', () => ({
  renderMarkdown: vi.fn((md: string) => <div data-testid="markdown">{md.slice(0, 40)}</div>),
}));

vi.mock('@revealui/router', () => ({
  Link: ({
    to,
    children,
    className,
  }: {
    to: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

describe('DocsIndexPage receipt motif', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a static receipt header with audit-receipts link (no print animation)', () => {
    const { container } = render(<DocsIndexPage />);

    expect(screen.getByRole('region', { name: 'Governed action, on record' })).toBeInTheDocument();
    expect(screen.getByText(/If an agent did it, there's a receipt\./)).toBeInTheDocument();

    const docsLink = screen.getByRole('link', { name: 'Audit receipts docs →' });
    expect(docsLink).toHaveAttribute('href', '/security/audit-receipts');

    // Static only: print animation injects a <style> tag when animate="print".
    expect(container.querySelector('style')).toBeNull();
    expect(screen.getByTestId('markdown')).toBeInTheDocument();
  });

  it('does not sell Cloud as a hosted signup and keeps waitlist honesty', () => {
    render(<DocsIndexPage />);
    expect(screen.queryByText(/hosted product you can sign up for in minutes/i)).toBeNull();
    expect(screen.getByText(/RevealUI Cloud is waitlist, not sold/i)).toBeInTheDocument();
  });

  it('exposes Start free and Book an intro CTAs at the top', () => {
    render(<DocsIndexPage />);
    const start = screen.getByRole('link', { name: 'Start free' });
    const intro = screen.getByRole('link', { name: 'Book an intro' });
    expect(start).toHaveAttribute('href', 'https://admin.revealui.com/signup');
    expect(intro).toHaveAttribute(
      'href',
      'https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ21UZVcuYp7yO32rZmhyUvZFDJcvles81E9edGNFwSUP8SHEVzGvq0gKgNFo7q04YS5i-12ZE5P',
    );
    expect(intro.getAttribute('href') ?? '').toContain('https://calendar.google.com/');
  });
});
