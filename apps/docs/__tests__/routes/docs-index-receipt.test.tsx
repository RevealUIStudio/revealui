/**
 * Docs index is product reference only. The receipt motif lives on marketing.
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DocsIndexPage } from '../../app/routes/DocsIndexPage';

vi.mock('../../app/lib/head', () => ({
  applyDocHead: vi.fn(),
}));

vi.mock('../../app/utils/markdown', () => ({
  renderMarkdown: vi.fn((md: string) => <div data-testid="markdown">{md}</div>),
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

  it('does not render a receipt motif on the docs index', () => {
    render(<DocsIndexPage />);

    expect(screen.queryByRole('region', { name: 'Governed action, on record' })).toBeNull();
    expect(screen.queryByText(/If an agent did it, there's a receipt\./)).toBeNull();
    expect(screen.queryByRole('link', { name: 'Audit receipts docs →' })).toBeNull();
    expect(screen.queryByText('Governed action, on record')).toBeNull();

    expect(screen.getByTestId('markdown')).toBeInTheDocument();
    expect(screen.getByTestId('markdown')).toHaveTextContent('Quick Start');
    expect(screen.getByTestId('markdown')).toHaveTextContent('Next steps');
  });

  it('does not restore marketing CTAs on the docs landing', () => {
    render(<DocsIndexPage />);

    expect(screen.queryByRole('link', { name: 'Start free' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Book an intro' })).toBeNull();
  });
});
