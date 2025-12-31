import type { Metadata } from "next"

import { PayloadRedirects } from "@/lib/components/PayloadRedirects"
import configPromise from "@payload-config"
import { getPayloadHMR } from "@payloadcms/next/utilities"
import { draftMode } from "next/headers"
import { cache } from "react"

import { BlockProps, RenderBlocks } from "@/lib/blocks/RenderBlocks"
import { RenderHero } from "@/lib/heros/RenderHero"
import { generateMeta } from "@/lib/utilities/generateMeta"

// Force dynamic rendering to prevent build-time PayloadCMS initialization
export const dynamic = "force-dynamic";
export const dynamicParams = true;

// Removed generateStaticParams to prevent build-time initialization
// Pages will be generated on-demand at request time

export default async function Page({
  params,
}: {
  params: Promise<{ slug?: string }>
}) {
  const { slug = "home" } = await params
  const url = "/" + slug

  // let page: PageType | null;

  const page = await queryPageBySlug({
    slug,
  })

  if (!page) {
    return <PayloadRedirects url={url} />
  }

  const { hero, layout } = page

  return (
    <article className="pt-16 pb-24">
      {/* Allows redirects for valid pages too */}
      <PayloadRedirects disableNotFound url={url} />

      <RenderHero {...hero} />
      <RenderBlocks blocks={layout as unknown as BlockProps} />
    </article>
  )
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string }>
}): Promise<Metadata> {
  const { slug = "home" } = await params
  const page = await queryPageBySlug({
    slug,
  })

  return generateMeta({ doc: page })
}

const queryPageBySlug = cache(async ({ slug }: { slug: string }) => {
  const { isEnabled: draft } = await draftMode()

  const payload = await getPayloadHMR({ config: configPromise })

  const result = await payload.find({
    collection: "pages",
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
