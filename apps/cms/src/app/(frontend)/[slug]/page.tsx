import config from '@revealui/config'
import { getRevealUI } from '@revealui/core'
import type { Metadata } from 'next'
import { draftMode } from 'next/headers'
import { cache } from 'react'
import { RenderBlocks } from '@/lib/blocks/RenderBlocks'
import { RevealUIRedirects } from '@/lib/components/RevealUIRedirects'
import { RenderHero } from '@/lib/heros/RenderHero'
import { generateMeta } from '@/lib/utilities/generateMeta'
import type { Page } from '@revealui/types/cms'

// Force dynamic rendering to prevent build-time RevealUI CMS initialization
export const dynamic = 'force-dynamic'
export const dynamicParams = true

// Removed generateStaticParams to prevent build-time initialization
// Pages will be generated on-demand at request time

export default async function Page({ params }: { params: Promise<{ slug?: string }> }) {
  const { slug = 'home' } = await params
  const url = `/${slug}`

  // let page: PageType | null;

  const page = await queryPageBySlug({
    slug,
  })

  if (!page) {
    return <RevealUIRedirects url={url} />
  }

  const { hero, layout } = page

  return (
    <article className="pt-16 pb-24">
      {/* Allows redirects for valid pages too */}
      <RevealUIRedirects disableNotFound url={url} />

      {hero && <RenderHero {...(hero as Parameters<typeof RenderHero>[0])} />}
      {layout && Array.isArray(layout) && (
        <RenderBlocks blocks={layout as unknown as Page['layout']} />
      )}
    </article>
  )
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string }>
}): Promise<Metadata> {
  // During build, return minimal metadata to avoid database connections
  if (
    process.env.NODE_ENV === 'production' &&
    !process.env.POSTGRES_URL &&
    !process.env.DATABASE_URL
  ) {
    const { slug = 'home' } = await params
    return { title: slug }
  }

  try {
    const { slug = 'home' } = await params
    const page = await queryPageBySlug({
      slug,
    })
    return generateMeta({ doc: page })
  } catch {
    // If database isn't available, return minimal metadata
    const { slug = 'home' } = await params
    return { title: slug }
  }
}

const queryPageBySlug = cache(async ({ slug }: { slug: string }) => {
  // Skip database queries during build
  const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build'
  if (isBuildTime) {
    return null
  }

  try {
    const { isEnabled: draft } = await draftMode()
    const revealui = await getRevealUI({ config: config })

    const result = await revealui.find({
      collection: 'pages',
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
  } catch (error) {
    console.error('Error fetching page:', error)
    return null
  }
})
