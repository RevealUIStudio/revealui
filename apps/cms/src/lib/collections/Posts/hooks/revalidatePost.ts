import { revalidatePath } from 'next/cache'
import type { Post } from '@/types'

interface PayloadWithLogger {
  logger?: {
    info: (message: string) => void
    error: (message: string) => void
    warn: (message: string) => void
  }
}

export const revalidatePost = ({ doc, previousDoc, req }: {
  doc: Post
  previousDoc?: Post
  req: { payload?: PayloadWithLogger }
}) => {
  const payload = req?.payload as PayloadWithLogger | undefined

  if (doc._status === 'published') {
    const path = `/posts/${doc.slug}`

    payload?.logger?.info(`Revalidating post at path: ${path}`)

    revalidatePath(path)
  }

  // If the post was previously published, we need to revalidate the old path
  if (previousDoc?._status === 'published' && doc._status !== 'published') {
    const oldPath = `/posts/${previousDoc.slug}`

    payload?.logger?.info(`Revalidating old post at path: ${oldPath}`)

    revalidatePath(oldPath)
  }

  return doc
}
