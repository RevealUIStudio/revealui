import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useScrollLock } from '../../hooks/use-scroll-lock.js'

describe('useScrollLock', () => {
  beforeEach(() => {
    document.body.style.overflow = ''
    document.body.style.paddingRight = ''
  })

  it('should set body overflow to hidden when enabled', () => {
    renderHook(() => useScrollLock(true))
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('should not set overflow when disabled', () => {
    renderHook(() => useScrollLock(false))
    expect(document.body.style.overflow).toBe('')
  })

  it('should restore original overflow on unmount', () => {
    document.body.style.overflow = 'auto'

    const { unmount } = renderHook(() => useScrollLock(true))
    expect(document.body.style.overflow).toBe('hidden')

    unmount()
    expect(document.body.style.overflow).toBe('auto')
  })

  it('should restore original paddingRight on unmount', () => {
    document.body.style.paddingRight = '10px'

    const { unmount } = renderHook(() => useScrollLock(true))
    unmount()

    expect(document.body.style.paddingRight).toBe('10px')
  })

  it('should toggle lock when enabled changes', () => {
    const { rerender } = renderHook(({ enabled }) => useScrollLock(enabled), {
      initialProps: { enabled: false },
    })

    expect(document.body.style.overflow).toBe('')

    rerender({ enabled: true })
    expect(document.body.style.overflow).toBe('hidden')

    rerender({ enabled: false })
    expect(document.body.style.overflow).toBe('')
  })

  it('should be enabled by default (no arguments)', () => {
    renderHook(() => useScrollLock())
    expect(document.body.style.overflow).toBe('hidden')
  })
})
