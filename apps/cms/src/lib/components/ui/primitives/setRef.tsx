/* eslint-disable @typescript-eslint/no-explicit-any */
type PossibleRef<T> = React.Ref<T> | undefined

function setRef<T>(ref: PossibleRef<T>, value: T) {
  if (typeof ref === 'function') {
    ref(value)
  } else if (ref) {
    ;(ref as any).current = value
  }
}

export { setRef }
