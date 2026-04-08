import { ButtonBlockSchema } from '@revealui/contracts/content';
import type { Page } from '@revealui/core/types/cms';
import { logger } from '@revealui/utils/logger';
import { memo } from 'react';
import { CMSLink } from '@/lib/components/Link/index';
import RichText from '@/lib/components/RichText/index';

type Props = Extract<Page['layout'][0], { blockType: 'cta' }>;

export const CallToActionBlock = memo(({ links, richText }: Props) => {
  // Runtime validation with ButtonBlockSchema
  // Map cta blockType to button schema type
  try {
    const buttonBlockData = {
      type: 'button' as const,
      data: {
        text: links?.[0]?.link?.label || '',
        href: links?.[0]?.link?.url || '',
        variant: links?.[0]?.link?.appearance === 'outline' ? 'outline' : 'default',
      },
    };
    ButtonBlockSchema.parse(buttonBlockData);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      logger.warn('CallToActionBlock validation warning', { error });
    }
  }

  return (
    <div className="container">
      <div className="bg-card rounded border-border border p-4 flex flex-col gap-8 md:flex-row md:justify-between md:items-center">
        <div className="max-w-3xl flex items-center">
          {richText && <RichText className="mb-0" content={richText} enableGutter={false} />}
        </div>
        <div className="flex flex-col gap-8">
          {(links || []).map(({ link }, i) => (
            <CMSLink key={link.url || `${link.label || ''}-${i}`} size="lg" {...link} />
          ))}
        </div>
      </div>
    </div>
  );
});

CallToActionBlock.displayName = 'CallToActionBlock';
