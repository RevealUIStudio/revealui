import type { Post } from '@revealui/core/types/cms'
import type React from 'react'
import { cn } from '@/lib/styles/classnames'
import { Card } from '@/lib/components/Card/index'
import RichText from '@/lib/components/RichText/index'
import type { RichTextContent } from '../Form/Component'

export type RelatedPostsProps = {
  className?: string
  docs?: Post[]
  introContent?: RichTextContent | null
}

export const RelatedPosts: React.FC<RelatedPostsProps> = (props) => {
  const { className, docs, introContent } = props

  return (
    <div className={cn('container', className)}>
      {introContent && <RichText content={introContent} enableGutter={false} />}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8 items-stretch">
        {docs?.map((doc) => {
          if (typeof doc === 'string') return null

          return <Card key={doc.id} doc={doc} relationTo="posts" showCategories />
        })}
      </div>
    </div>
  )
}
