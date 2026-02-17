import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useTypeAhead } from '../../hooks/use-type-ahead.js'

function createKeyEvent(key: string) {
  return {
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
  } as unknown as React.KeyboardEvent
}

describe('useTypeAhead', () => {
  it('should match first item starting with typed character', () => {
    const onMatch = vi.fn()
    const items = ['Apple', 'Banana', 'Cherry']

    const { result } = renderHook(() =>
      useTypeAhead({
        getItemText: (i) => items[i],
        itemCount: items.length,
        onMatch,
      }),
    )

    act(() => result.current.onKeyDown(createKeyEvent('b')))
    expect(onMatch).toHaveBeenCalledWith(1)
  })

  it('should accumulate characters for multi-char search', () => {
    const onMatch = vi.fn()
    const items = ['Caramel', 'Cherry', 'Chocolate']

    const { result } = renderHook(() =>
      useTypeAhead({
        getItemText: (i) => items[i],
        itemCount: items.length,
        onMatch,
      }),
    )

    act(() => result.current.onKeyDown(createKeyEvent('c')))
    expect(onMatch).toHaveBeenCalledWith(0) // Caramel (first "c" match)

    act(() => result.current.onKeyDown(createKeyEvent('h')))
    expect(onMatch).toHaveBeenLastCalledWith(1) // Cherry (first "ch" match)
  })

  it('should be case-insensitive', () => {
    const onMatch = vi.fn()
    const items = ['apple', 'Banana']

    const { result } = renderHook(() =>
      useTypeAhead({
        getItemText: (i) => items[i],
        itemCount: items.length,
        onMatch,
      }),
    )

    act(() => result.current.onKeyDown(createKeyEvent('B')))
    expect(onMatch).toHaveBeenCalledWith(1)
  })

  it('should ignore modifier keys', () => {
    const onMatch = vi.fn()
    const items = ['Apple']

    const { result } = renderHook(() =>
      useTypeAhead({
        getItemText: (i) => items[i],
        itemCount: items.length,
        onMatch,
      }),
    )

    act(() => {
      result.current.onKeyDown({
        key: 'a',
        ctrlKey: true,
        metaKey: false,
        altKey: false,
      } as unknown as React.KeyboardEvent)
    })

    expect(onMatch).not.toHaveBeenCalled()
  })

  it('should ignore special keys', () => {
    const onMatch = vi.fn()
    const items = ['Apple']

    const { result } = renderHook(() =>
      useTypeAhead({
        getItemText: (i) => items[i],
        itemCount: items.length,
        onMatch,
      }),
    )

    act(() => result.current.onKeyDown(createKeyEvent('Enter')))
    act(() => result.current.onKeyDown(createKeyEvent('Escape')))
    act(() => result.current.onKeyDown(createKeyEvent('ArrowDown')))

    expect(onMatch).not.toHaveBeenCalled()
  })

  it('should reset buffer after timeout', () => {
    vi.useFakeTimers()
    const onMatch = vi.fn()
    const items = ['Cherry', 'Chocolate']

    const { result } = renderHook(() =>
      useTypeAhead({
        getItemText: (i) => items[i],
        itemCount: items.length,
        onMatch,
        timeout: 350,
      }),
    )

    act(() => result.current.onKeyDown(createKeyEvent('c')))
    expect(onMatch).toHaveBeenCalledWith(0) // Cherry

    // Wait for buffer to reset
    act(() => vi.advanceTimersByTime(400))

    // Now typing "c" again should match from scratch
    onMatch.mockClear()
    act(() => result.current.onKeyDown(createKeyEvent('c')))
    expect(onMatch).toHaveBeenCalledWith(0) // Cherry again

    vi.useRealTimers()
  })

  it('should not call onMatch when no items match', () => {
    const onMatch = vi.fn()
    const items = ['Apple', 'Banana']

    const { result } = renderHook(() =>
      useTypeAhead({
        getItemText: (i) => items[i],
        itemCount: items.length,
        onMatch,
      }),
    )

    act(() => result.current.onKeyDown(createKeyEvent('z')))
    expect(onMatch).not.toHaveBeenCalled()
  })
})
