import type { Page, Post } from '@revealui/core/types/admin';
import type { Metadata } from 'next';
import { mergeOpenGraph } from './mergeOpenGraph';

// Type for documents with optional SEO/meta fields. Pages (canonical-direct)
// carry `seo`; posts still carry the legacy `meta` group — accept either.
type SeoFields = {
  title?: string | null;
  description?: string | null;
  image?: { url?: string } | null;
} | null;

type DocWithMeta = {
  seo?: SeoFields;
  meta?: SeoFields;
  slug?: string | string[] | null;
};

export async function generateMeta(args: {
  doc: Page | Post | DocWithMeta | Record<string, unknown> | null;
}): Promise<Metadata> {
  const { doc } = args || {};

  const docFields = doc as DocWithMeta | null;
  const meta = docFields?.seo ?? docFields?.meta;
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
