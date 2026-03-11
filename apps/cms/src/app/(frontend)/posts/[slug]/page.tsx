import type { Post } from '@revealui/core/types/cms';
import type { Metadata } from 'next';
import { draftMode } from 'next/headers';
import { cache } from 'react';
import { RelatedPosts } from '@/lib/blocks/RelatedPosts/Component';
import { RevealUIRedirects } from '@/lib/components/RevealUIRedirects';
import RichText from '@/lib/components/RichText';
import { PostHero } from '@/lib/heros/PostHero';
import { generateMeta } from '@/lib/utilities/generateMeta';
import { getRevealUIInstance } from '@/lib/utilities/revealui-singleton';
import PageClient from './page.client';

// Force dynamic rendering to prevent build-time RevealUI CMS initialization
export const dynamic = 'force-dynamic';
export const dynamicParams = true;

// Removed generateStaticParams to prevent build-time initialization
// Posts will be generated on-demand at request time

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const url = `/posts/${slug}`;
  const result = await queryPostBySlug({ slug });

  if (!result) return <RevealUIRedirects url={url} />;

  return (
    <article className="pt-16 pb-16">
      <PageClient />

      {/* Allows redirects for valid pages too */}
      <RevealUIRedirects disableNotFound url={url} />

      <PostHero post={result} />

      <div className="flex flex-col items-center gap-4 pt-8">
        <div className="container lg:mx-0 lg:grid lg:grid-cols-[1fr_48rem_1fr] grid-rows-[1fr]">
          <RichText
            className="lg:grid lg:grid-cols-subgrid col-start-1 col-span-3 grid-rows-[1fr]"
            content={result.content}
            enableGutter={false}
          />
        </div>

        {result.relatedPosts && result.relatedPosts.length > 0 && (
          <RelatedPosts
            className="mt-12"
            docs={result.relatedPosts.filter(
              (relatedPost): relatedPost is Post =>
                typeof relatedPost === 'object' && relatedPost !== null,
            )}
          />
        )}
      </div>
    </article>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await queryPostBySlug({ slug });

  return generateMeta({ doc: post });
}

const queryPostBySlug = cache(async ({ slug }: { slug: string }): Promise<Post | null> => {
  const { isEnabled: draft } = await draftMode();

  const revealui = await getRevealUIInstance();

  const result = await revealui.find({
    collection: 'posts',
    draft,
    limit: 1,
    overrideAccess: true,
    where: {
      slug: {
        equals: slug,
      },
    },
  });

  // revealui.find() returns RevealDocument (generic CMS type). Post is the generated
  // type for this collection — cast at the typed boundary is the correct pattern here.
  return (result.docs?.[0] ?? null) as unknown as Post | null;
});
