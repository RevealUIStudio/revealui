import config from '@revealui/config'
import { getRevealUI } from '@revealui/core'
import type { Post } from '@revealui/core/types/cms'
import type { Metadata } from 'next/types'
import { CollectionArchive } from '@/lib/components/CollectionArchive'
import { PageRange } from '@/lib/components/PageRange'
import { Pagination } from '@/lib/components/Pagination'

// Force dynamic rendering to prevent build-time RevealUI CMS initialization
export const dynamic = 'force-dynamic'
export const dynamicParams = true

export default async function Page({ params }: { params: Promise<{ pageNumber?: number }> }) {
  const { pageNumber = 2 } = await params
  const revealui = await getRevealUI({ config: config })

  const posts = await revealui.find({
    collection: 'posts',
    depth: 1,
    limit: 12,
    page: pageNumber,
  })

  return (
    <div className="pt-24 pb-24">
      <div className="container mb-16">
        <div className="prose dark:prose-invert max-w-none">
          <h1>Posts</h1>
        </div>
      </div>

      <div className="container mb-8">
        <PageRange
          collection="posts"
          currentPage={posts.page}
          limit={12}
          totalDocs={posts.totalDocs}
        />
      </div>

      <CollectionArchive posts={posts.docs as unknown as Post[]} />

      <div className="container">
        {posts.totalPages > 1 && posts.page && (
          <Pagination page={posts.page} totalPages={posts.totalPages} />
        )}
      </div>
    </div>
  )
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ pageNumber?: number }>
}): Promise<Metadata> {
  const { pageNumber = 2 } = await params
  return {
    title: `RevealUI Posts Page ${pageNumber}`,
  }
}

// Removed generateStaticParams to prevent build-time initialization
// Pages will be generated on-demand at request time
