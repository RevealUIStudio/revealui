/**
 * Unknown docs routes must render a real Not Found page, never the SPA
 * index.html source as the article body (live bug 2026-08-24).
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SectionPage } from '../../app/routes/SectionPage';

vi.mock('@revealui/router', () => ({
  useParams: vi.fn(),
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

vi.mock('../../app/utils/markdown', () => ({
  loadMarkdownFile: vi.fn(),
  renderMarkdown: vi.fn((md: string) => md),
  parseFrontmatter: vi.fn((md: string) => ({ data: {}, body: md })),
}));

vi.mock('../../app/lib/head', () => ({
  applyDocHead: vi.fn(),
  setRobotsNoindex: vi.fn(),
}));

vi.mock('../../app/lib/slug-manifest', () => ({
  slugToPath: vi.fn(() => undefined),
}));

import { useParams } from '@revealui/router';
import { loadMarkdownFile } from '../../app/utils/markdown';

const mockLoadMarkdownFile = vi.mocked(loadMarkdownFile);
const mockUseParams = vi.mocked(useParams);

afterEach(() => {
  vi.clearAllMocks();
});

describe('SectionPage unknown route', () => {
  it('shows Not Found and never paints index.html source as the article', async () => {
    mockUseParams.mockReturnValue({ path: 'definitely-not-a-page' });
    mockLoadMarkdownFile.mockRejectedValue(new Error('404'));

    await act(async () => {
      render(<SectionPage section="docs" title="Documentation" />);
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Not Found' })).toBeInTheDocument();
    });

    expect(screen.queryByText(/<!DOCTYPE html>/i)).toBeNull();
    expect(screen.queryByText(/<html lang="en">/i)).toBeNull();
    expect(screen.queryByText(/Edit this page on GitHub/i)).toBeNull();
    expect(screen.getByRole('link', { name: /Back to documentation/i })).toHaveAttribute(
      'href',
      '/',
    );
  });
});
