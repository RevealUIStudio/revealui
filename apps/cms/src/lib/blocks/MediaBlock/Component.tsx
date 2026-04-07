import { ImageBlockSchema, VideoBlockSchema } from '@revealui/contracts/content';
import type { Page } from '@revealui/core/types/cms';
import { logger } from '@revealui/utils/logger';
import type { StaticImageData } from 'next/image';
import { memo } from 'react';
import { Media } from '@/lib/components/Media/index';
import RichText, { type RichTextContent } from '@/lib/components/RichText/index';
import { cn } from '@/lib/styles/classnames';

type Props = Extract<Page['layout'][0], { blockType: 'mediaBlock' }> & {
  breakout?: boolean;
  captionClassName?: string;
  className?: string;
  enableGutter?: boolean;
  id?: string;
  imgClassName?: string;
  staticImage?: StaticImageData;
  disableInnerContainer?: boolean;
};

export const MediaBlock = memo((props: Props) => {
  const {
    captionClassName,
    className,
    enableGutter = true,
    imgClassName,
    media,
    position = 'default',
    staticImage,
    disableInnerContainer,
  } = props;

  // Runtime validation with ImageBlockSchema or VideoBlockSchema
  // Determine block type based on media type (simplified - assumes image by default)
  try {
    const isVideo =
      media &&
      typeof media === 'object' &&
      'mimeType' in media &&
      typeof media.mimeType === 'string' &&
      media.mimeType.startsWith('video/');

    const blockType = isVideo ? 'video' : 'image';
    const blockData = {
      type: blockType as 'video' | 'image',
      data: {
        src: media && typeof media === 'object' && 'url' in media ? String(media.url) : '',
        alt: media && typeof media === 'object' && 'alt' in media ? String(media.alt || '') : '',
      },
    };

    if (isVideo) {
      VideoBlockSchema.parse(blockData);
    } else {
      ImageBlockSchema.parse(blockData);
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      logger.warn('MediaBlock validation warning', { error });
    }
  }

  let caption: unknown;
  if (media && typeof media === 'object') caption = media.caption;
  const hasCaption = Boolean(caption);

  return (
    <div
      className={cn(
        '',
        {
          container: position === 'default' && enableGutter,
        },
        className,
      )}
    >
      {position === 'fullscreen' && (
        <div className="relative">
          <Media resource={media} src={staticImage} />
        </div>
      )}
      {position === 'default' && (
        <Media imgClassName={cn('rounded', imgClassName)} resource={media} src={staticImage} />
      )}
      {hasCaption && (
        <div
          className={cn(
            'mt-6',
            {
              container: position === 'fullscreen' && !disableInnerContainer,
            },
            captionClassName,
          )}
        >
          <RichText
            content={
              ((caption as unknown) || {
                root: {
                  type: 'root',
                  children: [],
                  direction: 'ltr',
                  format: '',
                  indent: 0,
                  version: 1,
                },
              }) as RichTextContent
            }
            enableGutter={false}
          />
        </div>
      )}
    </div>
  );
});

MediaBlock.displayName = 'MediaBlock';
