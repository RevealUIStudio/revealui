import type { Post } from '@revealui/core/types/cms';
import { revalidatePath } from 'next/cache';

interface RevealUIWithLogger {
  logger?: {
    info: (message: string) => void;
    error: (message: string) => void;
    warn: (message: string) => void;
  };
}

export const revalidatePost = ({
  doc,
  previousDoc,
  req,
}: {
  doc: Post;
  previousDoc?: Post;
  req: { revealui?: RevealUIWithLogger };
}) => {
  const revealui = req?.revealui;

  if (doc._status === 'published') {
    const path = `/posts/${doc.slug}`;

    revealui?.logger?.info(`Revalidating post at path: ${path}`);

    revalidatePath(path);
  }

  // If the post was previously published, we need to revalidate the old path
  if (previousDoc?._status === 'published' && doc._status !== 'published') {
    const oldPath = `/posts/${previousDoc.slug}`;

    revealui?.logger?.info(`Revalidating old post at path: ${oldPath}`);

    revalidatePath(oldPath);
  }

  return doc;
};
