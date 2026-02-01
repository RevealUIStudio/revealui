import { getRevealUI } from '@revealui/core'
import type { Post } from '@revealui/core/types/cms'
import type { Metadata } from 'next/types'
import config from '@/../../revealui.config'
import { CollectionArchive } from '@/lib/components/CollectionArchive'
import { PageRange } from '@/lib/components/PageRange'
import { Pagination } from '@/lib/components/Pagination'

// Force dynamic rendering to prevent build-time RevealUI CMS initialization
export const dynamic = 'force-dynamic'
export const dynamicParams = true

export default async function Page() {
  const revealui = await getRevealUI({ config })

  const posts = await revealui.find({
    collection: 'posts',
    depth: 1,
    limit: 12,
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

export function generateMetadata(): Metadata {
  return {
    title: `RevealUI Posts`,
  }
}
