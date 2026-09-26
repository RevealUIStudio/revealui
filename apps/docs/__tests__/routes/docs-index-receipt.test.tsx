/**
 * Docs landing stays a documentation index. The governed-action ReceiptCard
 * lives on the marketing home, not DocsIndexPage.
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DOCS_RECEIPT_CAPTION, DOCS_RECEIPT_TITLE } from '../../app/content/receipt';
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

  it('does not mount the governed-action receipt on the docs landing', () => {
    render(<DocsIndexPage />);

    expect(screen.queryByRole('region', { name: DOCS_RECEIPT_TITLE })).toBeNull();
    expect(screen.queryByText(DOCS_RECEIPT_CAPTION.text)).toBeNull();
    expect(screen.queryByRole('link', { name: DOCS_RECEIPT_CAPTION.link.label })).toBeNull();

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
