/**
 * Docs landing is a documentation index, not a marketing surface.
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

describe('DocsIndexPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the documentation index markdown', () => {
    render(<DocsIndexPage />);

    const markdown = screen.getByTestId('markdown');
    expect(markdown).toHaveTextContent('RevealUI Documentation');
    expect(markdown).toHaveTextContent('Quick Start');
    expect(markdown).toHaveTextContent('Next steps');
    expect(markdown).toHaveTextContent('npx create-revealui@latest my-app');
  });

  it('does not sell Cloud as a hosted signup and keeps waitlist honesty', () => {
    render(<DocsIndexPage />);

    expect(screen.queryByText(/hosted product you can sign up for in minutes/i)).toBeNull();
    expect(screen.getByText(/RevealUI Cloud is waitlist, not sold/i)).toBeInTheDocument();
    expect(screen.getByText(/Self-host today/i)).toBeInTheDocument();
  });

  it('does not render a receipt hero or receipt caption', () => {
    const { container } = render(<DocsIndexPage />);

    expect(screen.queryByRole('region', { name: 'Governed action, on record' })).toBeNull();
    expect(screen.queryByText(/If an agent did it, there's a receipt\./)).toBeNull();
    expect(screen.queryByRole('link', { name: 'Audit receipts docs →' })).toBeNull();
    expect(container.querySelector('style')).toBeNull();
  });

  it('does not render marketing CTAs on the docs landing', () => {
    render(<DocsIndexPage />);

    expect(screen.queryByRole('link', { name: 'Start free' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Book an intro' })).toBeNull();
    expect(screen.queryByRole('link', { name: /sign up/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /pricing/i })).toBeNull();
  });
});
