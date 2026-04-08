import type { Page, Post } from '@revealui/core/types/cms';
import type { Metadata } from 'next';
import { mergeOpenGraph } from './mergeOpenGraph';

// Type for documents with optional meta fields
type DocWithMeta = {
  meta?: {
    title?: string | null;
    description?: string | null;
    image?: { url?: string } | null;
  } | null;
  slug?: string | string[] | null;
};

export async function generateMeta(args: {
  doc: Page | Post | DocWithMeta | Record<string, unknown> | null;
}): Promise<Metadata> {
  const { doc } = args || {};

  const meta = doc?.meta as DocWithMeta['meta'];
  const ogImage =
    typeof meta?.image === 'object' &&
    meta.image !== null &&
    'url' in meta.image &&
    `${process.env.NEXT_PUBLIC_SERVER_URL}${meta.image.url}`;

  const title = meta?.title ? `${meta?.title} | RevealUI` : 'RevealUI';

  return {
    description: meta?.description,
    openGraph: mergeOpenGraph({
      description: meta?.description || '',
      images: ogImage
        ? [
            {
              url: ogImage,
            },
          ]
        : undefined,
      title,
      url: Array.isArray(doc?.slug) ? doc?.slug.join('/') : '/',
    }),
    title,
  };
}
