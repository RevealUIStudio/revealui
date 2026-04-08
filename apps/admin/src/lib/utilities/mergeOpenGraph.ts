import type { Metadata } from 'next';

const defaultOpenGraph: Metadata['openGraph'] = {
  type: 'website',
  description: 'Agentic business runtime. Build your business, not your boilerplate.',
  images: [
    {
      url: process.env.NEXT_PUBLIC_SERVER_URL
        ? `${process.env.NEXT_PUBLIC_SERVER_URL.trim()}/favicon.svg`
        : '/favicon.svg',
    },
  ],
  siteName: 'RevealUI',
  title: 'RevealUI',
};

export const mergeOpenGraph = (og?: Metadata['openGraph']): Metadata['openGraph'] => {
  return {
    ...defaultOpenGraph,
    ...og,
    images: og?.images ? og.images : defaultOpenGraph.images,
  };
};
