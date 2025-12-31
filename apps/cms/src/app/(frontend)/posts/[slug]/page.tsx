import type { Metadata } from "next"

import { RelatedPosts } from "@/lib/blocks/RelatedPosts/Component"
import { PayloadRedirects } from "@/lib/components/PayloadRedirects"
import RichText from "@/lib/components/RichText"
import configPromise from "@payload-config"
import { getPayloadHMR } from "@payloadcms/next/utilities"
import { draftMode } from "next/headers"
import { cache } from "react"

import { PostHero } from "@/lib/heros/PostHero"
import { generateMeta } from "@/lib/utilities/generateMeta"
import PageClient from "./page.client"

// Force dynamic rendering to prevent build-time PayloadCMS initialization
export const dynamic = "force-dynamic";
export const dynamicParams = true;

// Removed generateStaticParams to prevent build-time initialization
// Posts will be generated on-demand at request time

export default async function Post({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const url = "/posts/" + slug
  const post = await queryPostBySlug({ slug })

  if (!post) return <PayloadRedirects url={url} />

  return (
    <article className="pt-16 pb-16">
      <PageClient />

      {/* Allows redirects for valid pages too */}
      <PayloadRedirects disableNotFound url={url} />

      <PostHero post={post} />

      <div className="flex flex-col items-center gap-4 pt-8">
        <div className="container lg:mx-0 lg:grid lg:grid-cols-[1fr_48rem_1fr] grid-rows-[1fr]">
          <RichText
            className="lg:grid lg:grid-cols-subgrid col-start-1 col-span-3 grid-rows-[1fr]"
            content={post.content}
            enableGutter={false}
          />
        </div>

        {post.relatedPosts && post.relatedPosts.length > 0 && (
          <RelatedPosts
            className="mt-12"
            docs={post.relatedPosts.filter((relatedPost: unknown) => typeof relatedPost === "object")}
          />
        )}
      </div>
    </article>
  )
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = await queryPostBySlug({ slug })

  return generateMeta({ doc: post })
}

const queryPostBySlug = cache(async ({ slug }: { slug: string }) => {
  const { isEnabled: draft } = await draftMode()

  const payload = await getPayloadHMR({ config: configPromise })

  const result = await payload.find({
    collection: "posts",
    draft,
    limit: 1,
    overrideAccess: true,
    where: {
      slug: {
        equals: slug,
      },
    },
  })

  return result.docs?.[0] || null
})
