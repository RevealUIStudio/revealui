import { getCacheLogger, revalidatePath as revalidateDataPath } from '@revealui/cache';
import type { Post } from '@revealui/core/types/admin';
import { revalidatePath } from 'next/cache';

interface RevealUIWithLogger {
  logger?: {
    info: (message: string) => void;
    error: (message: string) => void;
    warn: (message: string) => void;
  };
}

function bustPathCaches(path: string): void {
  void revalidateDataPath(path).catch((error: unknown) => {
    getCacheLogger().error('revalidatePost: data revalidatePath failed', {
      path,
      error: error instanceof Error ? error.message : String(error),
    });
  });
  revalidatePath(path);
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

    bustPathCaches(path);
  }

  // If the post was previously published, we need to revalidate the old path
  if (previousDoc?._status === 'published' && doc._status !== 'published') {
    const oldPath = `/posts/${previousDoc.slug}`;

    revealui?.logger?.info(`Revalidating old post at path: ${oldPath}`);

    bustPathCaches(oldPath);
  }

  return doc;
};
