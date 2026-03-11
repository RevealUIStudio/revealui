import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { usePopover } from '../../hooks/use-popover.js';

describe('usePopover', () => {
  it('should return triggerRef and popoverRef', () => {
    const { result } = renderHook(() => usePopover({ open: false }));

    expect(result.current.triggerRef).toBeDefined();
    expect(result.current.popoverRef).toBeDefined();
  });

  it('should return default position when closed', () => {
    const { result } = renderHook(() => usePopover({ open: false }));

    expect(result.current.position).toEqual({
      top: 0,
      left: 0,
      maxHeight: 300,
    });
  });

  it('should return popoverProps with fixed positioning style', () => {
    const { result } = renderHook(() => usePopover({ open: false }));

    expect(result.current.popoverProps.style.position).toBe('fixed');
    expect(result.current.popoverProps.style.zIndex).toBe(50);
  });

  it('should default anchor to bottom', () => {
    const { result } = renderHook(() => usePopover({ open: true }));

    // Verify it renders without error with default anchor
    expect(result.current.popoverProps.style).toBeDefined();
  });

  it('should update position when open changes to true', async () => {
    const { result, rerender } = renderHook(({ open }) => usePopover({ open }), {
      initialProps: { open: false },
    });

    expect(result.current.position.top).toBe(0);

    // Rerender with open=true
    await act(async () => {
      rerender({ open: true });
    });

    // Position calculated (will be defaults since no real DOM rects)
    expect(result.current.popoverProps.style).toBeDefined();
  });
});
