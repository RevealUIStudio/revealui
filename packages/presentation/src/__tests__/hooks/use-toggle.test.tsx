import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useToggle } from '../../hooks/use-toggle.js'

describe('useToggle', () => {
  describe('uncontrolled mode', () => {
    it('should default to unchecked', () => {
      const { result } = renderHook(() => useToggle())
      expect(result.current.checked).toBe(false)
    })

    it('should use defaultChecked as initial value', () => {
      const { result } = renderHook(() => useToggle({ defaultChecked: true }))
      expect(result.current.checked).toBe(true)
    })

    it('should toggle on calling toggle()', () => {
      const { result } = renderHook(() => useToggle())

      act(() => result.current.toggle())
      expect(result.current.checked).toBe(true)

      act(() => result.current.toggle())
      expect(result.current.checked).toBe(false)
    })

    it('should call onChange when toggled', () => {
      const onChange = vi.fn()
      const { result } = renderHook(() => useToggle({ onChange }))

      act(() => result.current.toggle())
      expect(onChange).toHaveBeenCalledWith(true)
    })
  })

  describe('controlled mode', () => {
    it('should use controlled checked value', () => {
      const { result } = renderHook(() => useToggle({ checked: true }))
      expect(result.current.checked).toBe(true)
    })

    it('should call onChange but not change internal state', () => {
      const onChange = vi.fn()
      const { result } = renderHook(() => useToggle({ checked: false, onChange }))

      act(() => result.current.toggle())
      expect(onChange).toHaveBeenCalledWith(true)
      expect(result.current.checked).toBe(false)
    })
  })

  describe('disabled', () => {
    it('should not toggle when disabled', () => {
      const onChange = vi.fn()
      const { result } = renderHook(() => useToggle({ disabled: true, onChange }))

      act(() => result.current.toggle())
      expect(result.current.checked).toBe(false)
      expect(onChange).not.toHaveBeenCalled()
    })
  })

  describe('toggleProps', () => {
    it('should have aria-checked matching checked state', () => {
      const { result } = renderHook(() => useToggle())
      expect(result.current.toggleProps['aria-checked']).toBe(false)

      act(() => result.current.toggle())
      expect(result.current.toggleProps['aria-checked']).toBe(true)
    })

    it('should set data-checked when checked', () => {
      const { result } = renderHook(() => useToggle({ defaultChecked: true }))
      expect(result.current.toggleProps['data-checked']).toBe('')
    })

    it('should set data-checked undefined when unchecked', () => {
      const { result } = renderHook(() => useToggle())
      expect(result.current.toggleProps['data-checked']).toBeUndefined()
    })

    it('should have tabIndex 0', () => {
      const { result } = renderHook(() => useToggle())
      expect(result.current.toggleProps.tabIndex).toBe(0)
    })

    it('should toggle on click', () => {
      const { result } = renderHook(() => useToggle())

      act(() => result.current.toggleProps.onClick())
      expect(result.current.checked).toBe(true)
    })

    it('should toggle on Space keydown', () => {
      const { result } = renderHook(() => useToggle())

      act(() => {
        result.current.toggleProps.onKeyDown({
          key: ' ',
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent)
      })

      expect(result.current.checked).toBe(true)
    })

    it('should not toggle on Enter keydown', () => {
      const { result } = renderHook(() => useToggle())

      act(() => {
        result.current.toggleProps.onKeyDown({
          key: 'Enter',
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent)
      })

      expect(result.current.checked).toBe(false)
    })
  })
})
