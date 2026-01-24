import type React from 'react'
import { usePageContext } from 'revealui/ui/hooks/usePageContext'

export { Page }

type PageContextError = {
  abortReason: { notAdmin?: boolean } | string
  abortStatusCode: number
  is404: boolean
}

function Page(): React.ReactElement {
  // usePageContext returns unknown - create a type-safe wrapper
  // The hook is from a framework that doesn't provide types, so we validate at runtime
  let pageContext: PageContextError

  // Call the hook and safely cast the result
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const rawContextUnknown: unknown = usePageContext()

  try {
    // Type assertion is necessary here because usePageContext is untyped
    // We validate the structure through destructuring with defaults
    const rawContext = rawContextUnknown as Partial<PageContextError>
    pageContext = {
      abortReason: rawContext.abortReason ?? '',
      abortStatusCode: rawContext.abortStatusCode ?? 500,
      is404: rawContext.is404 ?? false,
    }
  } catch {
    // Fallback if hook fails
    pageContext = {
      abortReason: '',
      abortStatusCode: 500,
      is404: false,
    }
  }

  const { abortReason, abortStatusCode, is404 } = pageContext

  let msg: string // Message shown to the user

  if (typeof abortReason === 'object' && abortReason?.notAdmin) {
    // Handle `throw render(403, { notAdmin: true })`
    msg = "You cannot access this page because you aren't an administrator."
  } else if (typeof abortReason === 'string') {
    // Handle `throw render(abortStatusCode, `You cannot access ${someCustomMessage}`)`
    msg = abortReason
  } else if (abortStatusCode === 403) {
    // Handle `throw render(403)`
    msg = "You cannot access this page because you don't have enough privileges."
  } else if (abortStatusCode === 401) {
    // Handle `throw render(401)`
    msg = "You cannot access this page because you aren't logged in. Please log in."
  } else {
    // Fallback error message
    msg = is404
      ? "This page doesn't exist."
      : 'Something went wrong. Sincere apologies. Try again (later).'
  }

  return <p>{msg}</p>
}
