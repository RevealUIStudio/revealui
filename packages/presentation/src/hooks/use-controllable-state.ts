import { useCallback, useRef, useState } from 'react'

export function useControllableState<T>({
  value: controlledValue,
  defaultValue,
  onChange,
}: {
  value?: T
  defaultValue: T
  onChange?: (value: T) => void
}): [T, (next: T | ((prev: T) => T)) => void] {
  const isControlled = controlledValue !== undefined
  const [internalValue, setInternalValue] = useState(defaultValue)
  const value = isControlled ? controlledValue : internalValue

  // Use ref to avoid stale closure over onChange
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolvedValue = typeof next === 'function' ? (next as (prev: T) => T)(value) : next

      if (!isControlled) {
        setInternalValue(resolvedValue)
      }
      onChangeRef.current?.(resolvedValue)
    },
    [isControlled, value],
  )

  return [value, setValue]
}
