'use client';
import type { Page } from '@revealui/core/types/admin';
import React, { useEffect } from 'react';
import { CMSLink } from '@/lib/components/Link/index';
import { Media } from '@/lib/components/Media/index';
import RichText from '@/lib/components/RichText/index';
import { useHeaderTheme } from '@/lib/providers/HeaderTheme/index';

export const HighImpactHero = ({ links, media, richText }: Page['hero']) => {
  const { setHeaderTheme } = useHeaderTheme();

  useEffect(() => {
    setHeaderTheme('dark');
  });

  const getLinkKey = (item: NonNullable<Page['hero']['links']>[number]) => {
    if (item.id) return item.id;

    const referenceValue = item.link?.reference?.value;
    if (typeof referenceValue === 'string' || typeof referenceValue === 'number') {
      return referenceValue;
    }
    if (referenceValue && typeof referenceValue === 'object' && 'id' in referenceValue) {
      return referenceValue.id;
    }

    return item.link?.url ?? item.link?.label ?? 'hero-link';
  };

  return (
    <div className="relative mt-[10.4rem] flex items-end text-white" data-theme="dark">
      <div className="container mb-8 z-10 relative">
        <div className="max-w-[34rem]">
          {richText && <RichText className="mb-6" content={richText} enableGutter={false} />}
          {Array.isArray(links) && links.length > 0 && (
            <ul className="flex gap-4">
              {links.map((item) => {
                return (
                  <li key={getLinkKey(item)}>
                    <CMSLink {...item.link} />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
      <div className="min-h-[80vh] select-none">
        {media && typeof media === 'object' && (
          <React.Fragment>
            <Media fill imgClassName="-z-10 object-cover" priority resource={media} />
            <div className="absolute pointer-events-none left-0 bottom-0 w-full h-1/2 bg-gradient-to-t from-black to-transparent" />
          </React.Fragment>
        )}
      </div>
    </div>
  );
};
