import { revalidateTag } from 'next/cache'

// Generic hook that works with various CMS hook signatures
export const revalidateRedirects = (args: { doc: unknown; req?: unknown; context?: unknown }) => {
  // Log if possible
  try {
    const ctx = args.context as
      | { revealui?: { logger?: { info?: (msg: string) => void } }; operation?: string }
      | undefined
    ctx?.revealui?.logger?.info?.(
      `Revalidating redirects after ${ctx?.operation || 'change'} operation`
    )
  } catch {
    // Ignore logging errors
  }

  revalidateTag('redirects', 'page')

  return args.doc
}
