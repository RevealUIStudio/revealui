/**
 * noindex tests: ProPage sets <meta name="robots" content="noindex, nofollow"> on
 * not-found branches and removes it on success or unmount.
 *
 * Does NOT mock setRobotsNoindex — exercises real DOM manipulation via jsdom.
 */

import { act, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProPage } from '../../app/routes/ProPage';

vi.mock('@revealui/router', () => ({
  useParams: vi.fn(),
}));

vi.mock('../../app/utils/markdown', () => ({
  loadMarkdownFile: vi.fn(),
  renderMarkdown: vi.fn((md: string) => md),
}));

import { useParams } from '@revealui/router';
import { loadMarkdownFile } from '../../app/utils/markdown';

const mockLoadMarkdownFile = vi.mocked(loadMarkdownFile);
const mockUseParams = vi.mocked(useParams);

function getRobotsTag(): HTMLMetaElement | null {
  return document.head.querySelector('meta[name="robots"]');
}

afterEach(() => {
  // Remove any leftover robots tag between tests
  getRobotsTag()?.remove();
});

describe('noindex — ProPage not-found branch', () => {
  it('adds noindex tag when both fetch attempts fail', async () => {
    mockUseParams.mockReturnValue({ path: 'missing-doc' });
    // Both the index.md and .md attempts reject
    mockLoadMarkdownFile.mockRejectedValue(new Error('404'));

    await act(async () => {
      render(<ProPage />);
    });

    await waitFor(() => {
      const tag = getRobotsTag();
      expect(tag).not.toBeNull();
      expect(tag?.getAttribute('content')).toBe('noindex, nofollow');
    });
  });

  it('does not add noindex tag on successful load', async () => {
    mockUseParams.mockReturnValue({ path: 'real-doc' });
    mockLoadMarkdownFile.mockResolvedValue('# Real document');

    await act(async () => {
      render(<ProPage />);
    });

    await waitFor(() => {
      expect(getRobotsTag()).toBeNull();
    });
  });

  it('removes noindex tag on unmount', async () => {
    mockUseParams.mockReturnValue({ path: 'gone-doc' });
    mockLoadMarkdownFile.mockRejectedValue(new Error('404'));

    let unmount!: () => void;
    await act(async () => {
      const result = render(<ProPage />);
      unmount = result.unmount;
    });

    await waitFor(() => {
      expect(getRobotsTag()).not.toBeNull();
    });

    act(() => {
      unmount();
    });

    expect(getRobotsTag()).toBeNull();
  });
});
