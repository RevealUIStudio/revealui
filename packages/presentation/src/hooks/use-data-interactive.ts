import { useCallback, useState } from 'react'

interface UseDataInteractiveOptions {
  disabled?: boolean
}

interface DataInteractiveProps {
  'data-hover'?: string
  'data-focus'?: string
  'data-active'?: string
  'data-disabled'?: string
  onPointerEnter: () => void
  onPointerLeave: () => void
  onPointerDown: () => void
  onPointerUp: () => void
  onFocus: (e: React.FocusEvent<HTMLElement>) => void
  onBlur: () => void
}

export function useDataInteractive({
  disabled = false,
}: UseDataInteractiveOptions = {}): DataInteractiveProps {
  const [hover, setHover] = useState(false)
  const [focus, setFocus] = useState(false)
  const [active, setActive] = useState(false)

  const onPointerEnter = useCallback(() => {
    if (!disabled) setHover(true)
  }, [disabled])

  const onPointerLeave = useCallback(() => {
    setHover(false)
    setActive(false)
  }, [])

  const onPointerDown = useCallback(() => {
    if (!disabled) setActive(true)
  }, [disabled])

  const onPointerUp = useCallback(() => {
    setActive(false)
  }, [])

  const onFocus = useCallback(
    (e: React.FocusEvent<HTMLElement>) => {
      if (!disabled && e.currentTarget.matches(':focus-visible')) {
        setFocus(true)
      }
    },
    [disabled],
  )

  const onBlur = useCallback(() => {
    setFocus(false)
  }, [])

  return {
    'data-hover': hover ? '' : undefined,
    'data-focus': focus ? '' : undefined,
    'data-active': active ? '' : undefined,
    'data-disabled': disabled ? '' : undefined,
    onPointerEnter,
    onPointerLeave,
    onPointerDown,
    onPointerUp,
    onFocus,
    onBlur,
  }
}
