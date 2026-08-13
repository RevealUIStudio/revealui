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
});
