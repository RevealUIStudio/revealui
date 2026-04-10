'use client';

import type { Media as CmsMedia, Post } from '@revealui/core/types/admin';
import { CardContent, Card as PresentationCard } from '@revealui/presentation/server';
import Link from 'next/link';
import { Fragment } from 'react';
import useClickableCard from '@/lib/hooks/useClickableCard';
import { cn } from '@/lib/styles/classnames';
import { Media } from '../Media/index';

interface CardDoc {
  slug?: string;
  title?: string;
  categories?: Array<{ id?: number | string; title?: string } | string>;
  meta?: {
    description?: string;
    image?: unknown;
  };
}

const isCmsMedia = (value: unknown): value is CmsMedia => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return 'id' in value && typeof (value as { id?: unknown }).id === 'number';
};

export const Card = (props: {
  alignItems?: 'center';
  className?: string;
  doc?: CardDoc | Post;
  relationTo?: 'posts';
  showCategories?: boolean;
  title?: string;
}) => {
  const { card, link } = useClickableCard<HTMLDivElement>({});
  const { className, doc, relationTo, showCategories, title: titleFromProps } = props;

  const { slug, categories, meta, title } = doc || {};
  const { description, image: metaImage } = meta || {};

  const hasCategories = categories && Array.isArray(categories) && categories.length > 0;
  const titleToUse = titleFromProps || title;
  const sanitizedDescription = description?.split('\u00a0').join(' ');
  const href = `/${relationTo}/${slug}`;

  return (
    <PresentationCard
      className={cn('overflow-hidden hover:cursor-pointer', className)}
      ref={card.ref}
    >
      <div className="relative w-full">
        {!metaImage && <div className="">No image</div>}
        {isCmsMedia(metaImage) ? <Media resource={metaImage} size="360px" /> : null}
      </div>
      <CardContent className="pt-4">
        {showCategories && hasCategories && (
          <div className="uppercase text-sm mb-4">
            <div>
              {categories?.map((category, index) => {
                if (typeof category === 'object' && category !== null) {
                  const { id, title: titleFromCategory } = category;

                  const categoryTitle = titleFromCategory || 'Untitled category';
                  const categoryKey =
                    typeof id === 'number' || typeof id === 'string' ? id : categoryTitle;

                  const isLast = index === categories.length - 1;

                  return (
                    <Fragment key={categoryKey}>
                      {categoryTitle}
                      {!isLast && <Fragment>, &nbsp;</Fragment>}
                    </Fragment>
                  );
                }

                return null;
              })}
            </div>
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
        {description && (
          <div className="mt-2">
            <p>{sanitizedDescription}</p>
          </div>
        )}
      </CardContent>
    </PresentationCard>
  );
};
