'use client'

import type { Media as CmsMedia, Post } from '@revealui/core/types/cms'
import Link from 'next/link'
import type React from 'react'
import { Fragment } from 'react'
import { cn } from '@/lib/styles/classnames'
import useClickableCard from '@/lib/hooks/useClickableCard'
import { Media } from '../Media/index'

interface CardDoc {
  slug?: string
  title?: string
  categories?: Array<{ id?: number | string; title?: string } | string>
  meta?: {
    description?: string
    image?: unknown
  }
}

const isCmsMedia = (value: unknown): value is CmsMedia => {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  return 'id' in value && typeof (value as { id?: unknown }).id === 'number'
}

export const Card: React.FC<{
  alignItems?: 'center'
  className?: string
  doc?: CardDoc | Post
  relationTo?: 'posts'
  showCategories?: boolean
  title?: string
}> = (props) => {
  const { card, link } = useClickableCard({})
  const { className, doc, relationTo, showCategories, title: titleFromProps } = props

  const { slug, categories, meta, title } = doc || {}
  const { description, image: metaImage } = meta || {}

  const hasCategories = categories && Array.isArray(categories) && categories.length > 0
  const titleToUse = titleFromProps || title
  const sanitizedDescription = description?.replace(/\s/g, ' ') // replace non-breaking space with white space
  const href = `/${relationTo}/${slug}`

  return (
    <article
      className={cn(
        'border border-border rounded-lg overflow-hidden bg-card hover:cursor-pointer',
        className,
      )}
      ref={card.ref}
    >
      <div className="relative w-full ">
        {!metaImage && <div className="">No image</div>}
        {isCmsMedia(metaImage) ? <Media resource={metaImage} size="360px" /> : null}
      </div>
      <div className="p-4">
        {showCategories && hasCategories && (
          <div className="uppercase text-sm mb-4">
            {showCategories && hasCategories && (
              <div>
                {categories?.map((category, index) => {
                  if (typeof category === 'object' && category !== null) {
                    const { id, title: titleFromCategory } = category

                    const categoryTitle = titleFromCategory || 'Untitled category'
                    const categoryKey =
                      typeof id === 'number' || typeof id === 'string' ? id : categoryTitle

                    const isLast = index === categories.length - 1

                    return (
                      <Fragment key={categoryKey}>
                        {categoryTitle}
                        {!isLast && <Fragment>, &nbsp;</Fragment>}
                      </Fragment>
                    )
                  }

                  return null
                })}
              </div>
            )}
          </div>
        )}
        {titleToUse && (
          <div className="prose">
            <h3>
              <Link className="not-prose" href={href} ref={link.ref}>
                {titleToUse}
              </Link>
            </h3>
          </div>
        )}
        {description && <div className="mt-2">{description && <p>{sanitizedDescription}</p>}</div>}
      </div>
    </article>
  )
}
