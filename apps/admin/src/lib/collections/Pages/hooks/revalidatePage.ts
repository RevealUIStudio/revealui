import { getCacheLogger, revalidatePath as revalidateDataPath } from '@revealui/cache';
import type { Page } from '@revealui/core/types/admin';
import { revalidatePath } from 'next/cache';

interface RevealUIWithLogger {
  logger?: {
    info: (message: string) => void;
    error: (message: string) => void;
    warn: (message: string) => void;
  };
}

function bustPathCaches(path: string): void {
  // Data cache (tag/prefix) + Next Full Route Cache while admin is still Next.
  void revalidateDataPath(path).catch((error: unknown) => {
    getCacheLogger().error('revalidatePage: data revalidatePath failed', {
      path,
      error: error instanceof Error ? error.message : String(error),
    });
  });
  revalidatePath(path);
}

export const revalidatePage = ({
  doc,
  previousDoc,
  req,
}: {
  doc: Page;
  previousDoc?: Page;
  req: { revealui?: RevealUIWithLogger };
}) => {
  const revealui = req?.revealui;

  if (doc._status === 'published') {
    const path = doc.slug === 'home' ? '/' : `/${doc.slug}`;

    revealui?.logger?.info(`Revalidating page at path: ${path}`);

    bustPathCaches(path);
  }

  // If the page was previously published, we need to revalidate the old path
  if (previousDoc?._status === 'published' && doc._status !== 'published') {
    const oldPath = previousDoc.slug === 'home' ? '/' : `/${previousDoc.slug}`;

    revealui?.logger?.info(`Revalidating old page at path: ${oldPath}`);

    bustPathCaches(oldPath);
  }

  return doc;
};
