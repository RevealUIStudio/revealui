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

  it('directs readers to self-hosted setup without a hosted signup', () => {
    render(<DocsIndexPage />);

    expect(screen.queryByText(/hosted product you can sign up for in minutes/i)).toBeNull();
    expect(screen.getByTestId('markdown')).toHaveTextContent('your self-hosted runtime');
    expect(screen.getByTestId('markdown')).toHaveTextContent(
      'Start with the guide for your chosen template',
    );
    expect(screen.getByTestId('markdown')).not.toHaveTextContent('RevealUI Cloud');
  });

  it('does not render marketing CTAs on the docs landing', () => {
    render(<DocsIndexPage />);

    expect(screen.queryByRole('link', { name: 'Start free' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Book an intro' })).toBeNull();
    expect(screen.queryByRole('link', { name: /sign up/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /pricing/i })).toBeNull();
  });
});
