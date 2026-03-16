/**
 * Tests for useWildcardPath hook
 */

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useWildcardPath } from '../../app/hooks/useWildcardPath';

// Mock @revealui/router
vi.mock('@revealui/router', () => ({
  useParams: vi.fn(),
}));

// Import the mocked module for per-test overrides
import { useParams } from '@revealui/router';

describe('useWildcardPath', () => {
  it('returns undefined when no matching param exists', () => {
    vi.mocked(useParams).mockReturnValue({});
    const { result } = renderHook(() => useWildcardPath());
    expect(result.current).toBeUndefined();
  });

  it('joins array values with forward slash', () => {
    vi.mocked(useParams).mockReturnValue({ path: ['guides', 'getting-started'] });
    const { result } = renderHook(() => useWildcardPath());
    expect(result.current).toBe('guides/getting-started');
  });

  it('returns string value directly', () => {
    vi.mocked(useParams).mockReturnValue({ path: 'getting-started' });
    const { result } = renderHook(() => useWildcardPath());
    expect(result.current).toBe('getting-started');
  });

  it('uses custom param name', () => {
    vi.mocked(useParams).mockReturnValue({ slug: ['api', 'core'] });
    const { result } = renderHook(() => useWildcardPath('slug'));
    expect(result.current).toBe('api/core');
  });

  it('handles single-element array', () => {
    vi.mocked(useParams).mockReturnValue({ path: ['overview'] });
    const { result } = renderHook(() => useWildcardPath());
    expect(result.current).toBe('overview');
  });

  it('handles empty array', () => {
    vi.mocked(useParams).mockReturnValue({ path: [] });
    const { result } = renderHook(() => useWildcardPath());
    expect(result.current).toBe('');
  });

  it('handles deeply nested path array', () => {
    vi.mocked(useParams).mockReturnValue({ path: ['api', 'revealui-core', 'auth', 'session'] });
    const { result } = renderHook(() => useWildcardPath());
    expect(result.current).toBe('api/revealui-core/auth/session');
  });
});
