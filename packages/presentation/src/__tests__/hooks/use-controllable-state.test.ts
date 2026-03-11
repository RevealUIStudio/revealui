import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useControllableState } from '../../hooks/use-controllable-state.js';

describe('useControllableState', () => {
  describe('uncontrolled mode', () => {
    it('should use defaultValue as initial state', () => {
      const { result } = renderHook(() => useControllableState({ defaultValue: 'hello' }));
      expect(result.current[0]).toBe('hello');
    });

    it('should update state when setValue is called', () => {
      const { result } = renderHook(() => useControllableState({ defaultValue: 0 }));

      act(() => {
        result.current[1](42);
      });

      expect(result.current[0]).toBe(42);
    });

    it('should support function updater', () => {
      const { result } = renderHook(() => useControllableState({ defaultValue: 10 }));

      act(() => {
        result.current[1]((prev) => prev + 5);
      });

      expect(result.current[0]).toBe(15);
    });

    it('should call onChange when value changes', () => {
      const onChange = vi.fn();
      const { result } = renderHook(() => useControllableState({ defaultValue: 0, onChange }));

      act(() => {
        result.current[1](1);
      });

      expect(onChange).toHaveBeenCalledWith(1);
    });
  });

  describe('controlled mode', () => {
    it('should use controlled value over defaultValue', () => {
      const { result } = renderHook(() =>
        useControllableState({ value: 'controlled', defaultValue: 'default' }),
      );
      expect(result.current[0]).toBe('controlled');
    });

    it('should not update internal state when controlled', () => {
      const { result } = renderHook(() =>
        useControllableState({ value: 'controlled', defaultValue: 'default' }),
      );

      act(() => {
        result.current[1]('new value');
      });

      expect(result.current[0]).toBe('controlled');
    });

    it('should call onChange when setValue is called in controlled mode', () => {
      const onChange = vi.fn();
      const { result } = renderHook(() =>
        useControllableState({
          value: 'controlled',
          defaultValue: 'default',
          onChange,
        }),
      );

      act(() => {
        result.current[1]('new value');
      });

      expect(onChange).toHaveBeenCalledWith('new value');
    });

    it('should reflect updated controlled value on rerender', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useControllableState({ value, defaultValue: 'default' }),
        { initialProps: { value: 'first' as string | undefined } },
      );

      expect(result.current[0]).toBe('first');

      rerender({ value: 'second' });
      expect(result.current[0]).toBe('second');
    });
  });

  describe('edge cases', () => {
    it('should handle boolean values', () => {
      const { result } = renderHook(() => useControllableState({ defaultValue: false }));

      expect(result.current[0]).toBe(false);

      act(() => {
        result.current[1](true);
      });

      expect(result.current[0]).toBe(true);
    });

    it('should handle null values in uncontrolled mode', () => {
      const { result } = renderHook(() =>
        useControllableState({ defaultValue: null as string | null }),
      );

      expect(result.current[0]).toBe(null);

      act(() => {
        result.current[1]('value');
      });

      expect(result.current[0]).toBe('value');
    });

    it('should use latest onChange via ref (no stale closure)', () => {
      const onChange1 = vi.fn();
      const onChange2 = vi.fn();

      const { result, rerender } = renderHook(
        ({ onChange }) => useControllableState({ defaultValue: 0, onChange }),
        { initialProps: { onChange: onChange1 } },
      );

      rerender({ onChange: onChange2 });

      act(() => {
        result.current[1](1);
      });

      expect(onChange1).not.toHaveBeenCalled();
      expect(onChange2).toHaveBeenCalledWith(1);
    });
  });
});
