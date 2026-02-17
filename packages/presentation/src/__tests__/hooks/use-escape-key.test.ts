import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useEscapeKey } from '../../hooks/use-escape-key.js'

describe('useEscapeKey', () => {
  it('should call onEscape when Escape is pressed', () => {
    const onEscape = vi.fn()
    renderHook(() => useEscapeKey(onEscape))

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(onEscape).toHaveBeenCalledOnce()
  })

  it('should not call onEscape for other keys', () => {
    const onEscape = vi.fn()
    renderHook(() => useEscapeKey(onEscape))

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))

    expect(onEscape).not.toHaveBeenCalled()
  })

  it('should not call onEscape when disabled', () => {
    const onEscape = vi.fn()
    renderHook(() => useEscapeKey(onEscape, false))

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(onEscape).not.toHaveBeenCalled()
  })

  it('should start listening when re-enabled', () => {
    const onEscape = vi.fn()
    const { rerender } = renderHook(({ enabled }) => useEscapeKey(onEscape, enabled), {
      initialProps: { enabled: false },
    })

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(onEscape).not.toHaveBeenCalled()

    rerender({ enabled: true })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(onEscape).toHaveBeenCalledOnce()
  })

  it('should clean up listener on unmount', () => {
    const onEscape = vi.fn()
    const { unmount } = renderHook(() => useEscapeKey(onEscape))

    unmount()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(onEscape).not.toHaveBeenCalled()
  })

  it('should use latest callback via ref (no stale closure)', () => {
    const callback1 = vi.fn()
    const callback2 = vi.fn()

    const { rerender } = renderHook(({ cb }) => useEscapeKey(cb), {
      initialProps: { cb: callback1 },
    })

    rerender({ cb: callback2 })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(callback1).not.toHaveBeenCalled()
    expect(callback2).toHaveBeenCalledOnce()
  })

  it('should stop propagation of the Escape event', () => {
    const onEscape = vi.fn()
    renderHook(() => useEscapeKey(onEscape))

    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
    })
    const stopPropagation = vi.spyOn(event, 'stopPropagation')

    document.dispatchEvent(event)

    expect(stopPropagation).toHaveBeenCalled()
  })
})
