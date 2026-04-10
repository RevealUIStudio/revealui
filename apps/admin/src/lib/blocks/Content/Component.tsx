import { TextBlockSchema } from '@revealui/contracts/content';
import type { Page } from '@revealui/core/types/admin';
import { logger } from '@revealui/utils/logger';
import { memo } from 'react';
import { CMSLink } from '@/lib/components/Link/index';
import RichText from '@/lib/components/RichText/index';
import { cn } from '@/lib/styles/classnames';
import type { RichTextContent } from '../Form/Component';

// Define possible sizes for columns
type SizeType = 'full' | 'half' | 'oneThird' | 'twoThirds';

// Mapping of size types to Tailwind CSS grid classes
const colsSpanClasses: Record<SizeType, string> = {
  full: '12',
  half: '6',
  oneThird: '4',
  twoThirds: '8',
};

// Define the structure of a column
type ColumnType = {
  enableLink: boolean;
  link?: {
    href: string;
    label: string;
  } | null;
  richText: RichTextContent | null;
  size: SizeType;
};

// Props type for the ContentBlock component
export type Props = Extract<Page['layout'][0], { blockType: 'content' }> & {
  columns: ColumnType[];
};

// Main ContentBlock component
export const ContentBlock = memo(({ columns }: Props) => {
  // Runtime validation with TextBlockSchema
  // Validate the content block structure matches schema
  try {
    const textBlockData = {
      type: 'text' as const,
      data: {
        content: columns.map((col) => col.richText).filter(Boolean),
      },
    };
    TextBlockSchema.parse(textBlockData);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      logger.warn('ContentBlock validation warning', { error });
    }
  }

  if (!columns || columns.length === 0) {
    return null;
  }

  return (
    <div className="container my-16">
      <div className="grid grid-cols-4 lg:grid-cols-12 gap-y-8 gap-x-16">
        {columns.map((col, index) => {
          const { enableLink, link, richText, size } = col;

          // Validate column size
          const colSize = size && size in colsSpanClasses ? size : 'full';

          return (
            <div
              className={cn(`col-span-4 lg:col-span-${colsSpanClasses[colSize]}`, {
                'md:col-span-2': colSize !== 'full',
              })}
              key={col.id || `column-${index}`}
            >
              {richText && <RichText content={richText} enableGutter={false} />}

              {enableLink && link && <CMSLink {...link} />}
            </div>
          );
        })}
      </div>
    </div>
  );
});

ContentBlock.displayName = 'ContentBlock';
