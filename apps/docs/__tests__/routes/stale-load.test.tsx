/**
 * Stale-load race: latest navigation wins, superseded responses are discarded.
 *
 * Each test resolves OLD fetch *after* NEW fetch to confirm the cancelled flag
 * prevents OLD content from overwriting the current page.
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProPage } from '../../app/routes/ProPage';
import { SectionPage } from '../../app/routes/SectionPage';

vi.mock('@revealui/router', () => ({
  useParams: vi.fn(),
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

describe('stale-load race — SectionPage', () => {
  it('renders NEW content when OLD fetch resolves after NEW', async () => {
    // OLD fetch (for /docs/slow-page) is slow; NEW fetch (for /docs/fast-page) is fast
    let resolveOld!: (value: string) => void;
    let resolveNew!: (value: string) => void;
    const oldFetch = new Promise<string>((r) => {
      resolveOld = r;
    });
    const newFetch = new Promise<string>((r) => {
      resolveNew = r;
    });

    // First call → OLD, second call → NEW
    mockLoadMarkdownFile.mockReturnValueOnce(oldFetch).mockReturnValueOnce(newFetch);

    // Start on "slow-page"
    mockUseParams.mockReturnValue({ path: 'slow-page' });
    const { rerender } = render(<SectionPage section="docs" title="Docs" />);

    // Navigate to "fast-page" before OLD resolves
    mockUseParams.mockReturnValue({ path: 'fast-page' });
    rerender(<SectionPage section="docs" title="Docs" />);

    // Resolve NEW first
    await act(async () => {
      resolveNew('# New page content');
    });
    await waitFor(() => expect(screen.queryByText(/Loading/i)).toBeNull());

    // Now resolve OLD — should be ignored
    await act(async () => {
      resolveOld('# Old stale content');
    });

    expect(screen.queryByText('# Old stale content')).toBeNull();
    expect(screen.getByText('# New page content')).toBeInTheDocument();
  });
});

describe('stale-load race — ProPage', () => {
  it('renders NEW content when OLD fetch resolves after NEW', async () => {
    let resolveOld!: (value: string) => void;
    let resolveNew!: (value: string) => void;
    const oldFetch = new Promise<string>((r) => {
      resolveOld = r;
    });
    const newFetch = new Promise<string>((r) => {
      resolveNew = r;
    });

    mockLoadMarkdownFile.mockReturnValueOnce(oldFetch).mockReturnValueOnce(newFetch);

    mockUseParams.mockReturnValue({ path: 'slow-doc' });
    const { rerender } = render(<ProPage />);

    mockUseParams.mockReturnValue({ path: 'fast-doc' });
    rerender(<ProPage />);

    await act(async () => {
      resolveNew('# New pro content');
    });
    await waitFor(() => expect(screen.queryByText(/Loading/i)).toBeNull());

    await act(async () => {
      resolveOld('# Old pro content');
    });

    expect(screen.queryByText('# Old pro content')).toBeNull();
    expect(screen.getByText('# New pro content')).toBeInTheDocument();
  });
});
