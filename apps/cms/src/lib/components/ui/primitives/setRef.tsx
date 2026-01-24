import type React from 'react'

type PossibleRef<T> = React.Ref<T> | undefined

function setRef<T>(ref: PossibleRef<T>, value: T) {
  if (typeof ref === 'function') {
    ref(value)
  } else if (ref && 'current' in ref) {
    // ref is a MutableRefObject-like object
    ;(ref as React.MutableRefObject<T>).current = value
  }
}

export { setRef }
