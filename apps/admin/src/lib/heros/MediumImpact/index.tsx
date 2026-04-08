import type { Page } from '@revealui/core/types/cms';
import { CMSLink } from '@/lib/components/Link/index';
import { Media } from '@/lib/components/Media/index';
import RichText from '@/lib/components/RichText/index';

export const MediumImpactHero = ({ links, media, richText }: Page['hero']) => {
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
    <div className="">
      <div className="container mb-8">
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
      <div className="container ">
        {media && typeof media === 'object' && (
          <div>
            <Media
              className="-mx-4 md:-mx-8 2xl:-mx-16"
              imgClassName=""
              priority
              resource={media}
            />
            {media?.caption && (
              <div className="mt-3">
                <RichText content={media.caption} enableGutter={false} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
