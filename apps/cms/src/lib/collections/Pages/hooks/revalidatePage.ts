import { revalidatePath } from 'next/cache'
import type { Page } from '@/types'

interface PayloadWithLogger {
  logger?: {
    info: (message: string) => void
    error: (message: string) => void
    warn: (message: string) => void
  }
}

export const revalidatePage = ({
  doc,
  previousDoc,
  req,
}: {
  doc: Page
  previousDoc?: Page
  req: { payload?: PayloadWithLogger }
}) => {
  const payload = req?.payload as PayloadWithLogger | undefined

  if (doc._status === 'published') {
    const path = doc.slug === 'home' ? '/' : `/${doc.slug}`

    payload?.logger?.info(`Revalidating page at path: ${path}`)

    revalidatePath(path)
  }

  // If the page was previously published, we need to revalidate the old path
  if (previousDoc?._status === 'published' && doc._status !== 'published') {
    const oldPath = previousDoc.slug === 'home' ? '/' : `/${previousDoc.slug}`

    payload?.logger?.info(`Revalidating old page at path: ${oldPath}`)

    revalidatePath(oldPath)
  }

  return doc
}
