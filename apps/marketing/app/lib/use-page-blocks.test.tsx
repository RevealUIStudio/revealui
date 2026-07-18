import type { Block } from '@revealui/contracts/content';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPageBlocks } from './api';
import { HOME_FALLBACK_BLOCKS, homeBlocks, productsBlocks } from './page-blocks';
import { useMarketingPageBlocks } from './use-page-blocks';

vi.mock('./api', () => ({ fetchPageBlocks: vi.fn() }));

const mockFetch = vi.mocked(fetchPageBlocks);

describe('useMarketingPageBlocks', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('paints with the static fallback immediately', () => {
    mockFetch.mockResolvedValue(null);
    const { result } = renderHook(() => useMarketingPageBlocks('home', HOME_FALLBACK_BLOCKS));
    expect(result.current).toBe(HOME_FALLBACK_BLOCKS);
  });

  it('keeps the fallback when the API errors or misses', async () => {
    mockFetch.mockResolvedValue(null);
    const { result } = renderHook(() => useMarketingPageBlocks('home', HOME_FALLBACK_BLOCKS));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('home'));
    expect(result.current).toBe(HOME_FALLBACK_BLOCKS);
  });

  it('overrides with a valid CMS payload of matching shape', async () => {
    const overridden = homeBlocks();
    const section = overridden[0];
    if (section?.type === 'section') {
      section.data.heading = 'CMS-overridden demo heading';
    }
    mockFetch.mockResolvedValue(overridden);
    const { result } = renderHook(() => useMarketingPageBlocks('home', HOME_FALLBACK_BLOCKS));
    await waitFor(() => {
      const first = result.current[0];
      expect(first?.type === 'section' && first.data.heading).toBe('CMS-overridden demo heading');
    });
  });

  it('keeps the fallback when the CMS payload fails schema validation', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // A `section` block with no `data` is schema-invalid.
    mockFetch.mockResolvedValue([{ id: 'x', type: 'section' } as unknown as Block]);
    const { result } = renderHook(() => useMarketingPageBlocks('home', HOME_FALLBACK_BLOCKS));
    await waitFor(() => expect(warn).toHaveBeenCalled());
    expect(result.current).toBe(HOME_FALLBACK_BLOCKS);
  });

  it('keeps the fallback when the CMS payload shape does not match', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // A valid hero block where the home fallback expects [section, ctaSection].
    mockFetch.mockResolvedValue(productsBlocks().slice(0, 1));
    const { result } = renderHook(() => useMarketingPageBlocks('home', HOME_FALLBACK_BLOCKS));
    await waitFor(() => expect(warn).toHaveBeenCalled());
    expect(result.current).toBe(HOME_FALLBACK_BLOCKS);
  });
});
