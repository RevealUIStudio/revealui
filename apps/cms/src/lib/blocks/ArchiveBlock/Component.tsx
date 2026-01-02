import configPromise from '@reveal-config'
import { getRevealUI } from '@revealui/cms'
import type React from 'react'
import type { Category, Post } from '@/types'
import { CollectionArchive } from '../../components/CollectionArchive'
import RichText from '../../components/RichText'

export interface ArchiveBlockProps {
  introContent?: {
    root: {
      type: string
      children: {
        type: string
        version: number
        [k: string]: unknown
      }[]
      direction: ('ltr' | 'rtl') | null
      format: 'left' | 'start' | 'center' | 'right' | 'end' | 'justify' | ''
      indent: number
      version: number
    }
    [k: string]: unknown
  } | null
  populateBy?: 'collection' | 'selection' | null
  relationTo?: 'posts' | null
  categories?: (string | Category)[] | null
  limit?: number | null
  selectedDocs?:
    | {
        relationTo: 'posts'
        value: string | Post
      }[]
    | null
  id?: string | null
  blockName?: string | null
  blockType: 'archive'
}

export const ArchiveBlock: React.FC<ArchiveBlockProps> = async (props) => {
  const { id, categories, introContent, limit: limitFromProps, populateBy, selectedDocs } = props
  const limit = limitFromProps || 3

  let posts: Post[] = []

  if (populateBy === 'collection') {
    const revealui = await getRevealUI({ config: configPromise })

    const flattenedCategories = categories?.map((category) =>
      typeof category === 'object' ? category.id : category
    )

    const fetchedPosts = await revealui.find({
      collection: 'posts',
      depth: 1,
      limit,
      ...(flattenedCategories && flattenedCategories.length > 0
        ? {
            where: {
              categories: {
                in: flattenedCategories,
              },
            },
          }
        : {}),
    })

    posts = (fetchedPosts.docs as unknown as Post[]).map((doc) => doc)
  } else if (selectedDocs?.length) {
    posts = selectedDocs
      .map((doc: { relationTo: 'posts'; value: string | Post }) =>
        typeof doc.value === 'object' ? doc.value : null
      )
      .filter(Boolean) as Post[]
  }

  return (
    <div className="my-16" id={`block-${id}`}>
      {introContent && (
        <div className="container mb-16">
          <RichText className="ml-0 max-w-3xl" content={introContent} enableGutter={false} />
        </div>
      )}
      <CollectionArchive posts={posts} />
    </div>
  )
}
