function composeEventHandlers<E>(
  originalEventHandler?: (event: E) => void,
  ourEventHandler?: (event: E) => void,
  { checkForDefaultPrevented = true } = {},
): (event: E) => undefined | undefined {
  return function handleEvent(event: E): undefined | undefined {
    originalEventHandler?.(event)

    if (checkForDefaultPrevented === false || !(event as Event).defaultPrevented) {
      return ourEventHandler?.(event)
    }
  }
}

export { composeEventHandlers }
