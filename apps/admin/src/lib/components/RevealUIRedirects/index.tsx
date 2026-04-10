import type { Page, Post, Redirect } from '@revealui/core/types/admin';
import { notFound, redirect } from 'next/navigation';
import { getCachedDocument } from '@/lib/utilities/getDocument';
import { getCachedRedirects } from '@/lib/utilities/getRedirects';
import { asDocument } from '@/lib/utils/type-guards';

interface Props {
  disableNotFound?: boolean;
  url: string;
}

/* This component helps us with SSR based dynamic redirects */
export const RevealUIRedirects = async ({ disableNotFound, url }: Props) => {
  const slug = url.startsWith('/') ? url : `${url}`;

  const redirects = await getCachedRedirects()();

  const redirectItem = redirects.find((redirectItem: Redirect) => redirectItem.from === slug);

  if (redirectItem) {
    if (redirectItem.to?.url) {
      redirect(redirectItem.to.url);
    }

    let redirectUrl: string;

    if (typeof redirectItem.to?.reference?.value === 'string') {
      const collection = redirectItem.to?.reference?.relationTo;
      const id = redirectItem.to?.reference?.value;

      const document = asDocument<Page | Post>(await getCachedDocument(collection, id)());
      redirectUrl = `${redirectItem.to?.reference?.relationTo !== 'pages' ? `/${redirectItem.to?.reference?.relationTo}` : ''}/${
        document?.slug
      }`;
    } else {
      redirectUrl = `${redirectItem.to?.reference?.relationTo !== 'pages' ? `/${redirectItem.to?.reference?.relationTo}` : ''}/${
        typeof redirectItem.to?.reference?.value === 'object'
          ? redirectItem.to?.reference?.value?.slug
          : ''
      }`;
    }

    if (redirectUrl) redirect(redirectUrl);
  }

  if (disableNotFound) return null;
  return notFound();
};
