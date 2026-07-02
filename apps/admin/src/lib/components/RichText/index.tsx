import type { SerializedEditorState } from '@revealui/core/richtext';
import { serializeLexicalState } from '@revealui/core/richtext';
import type { Page, Post } from '@revealui/core/types/admin';
import { cn } from '@revealui/presentation/server';
import Image from 'next/image';
import type { JSX } from 'react';
import { BannerBlock, type BannerBlockProps } from '@/lib/blocks/Banner/Component';
import { CallToActionBlock } from '@/lib/blocks/CallToAction/Component';
import { CodeBlock, type CodeBlockProps } from '@/lib/blocks/Code/Component';
import { MediaBlock } from '@/lib/blocks/MediaBlock/Component';
import { CMSLink } from '../Link/index';

// Rich text content type (Lexical format)
export interface RichTextContent {
  root: {
    type: string;
    children: Array<{
      type: string;
      version: number;
      [key: string]: unknown;
    }>;
    direction: ('ltr' | 'rtl') | null;
    format: 'left' | 'start' | 'center' | 'right' | 'end' | 'justify' | '';
    indent: number;
    version: number;
  };
  [key: string]: unknown;
}

type Props = {
  className?: string;
  content: RichTextContent | null | undefined;
  enableGutter?: boolean;
  enableProse?: boolean;
};

// Link reference shape consumed by CMSLink
interface LinkReference {
  relationTo: 'pages' | 'posts';
  value: Page | Post | string | number;
}

type CtaBlockFields = Extract<Page['layout'][0], { blockType: 'cta' }>;
type MediaBlockFields = Extract<Page['layout'][0], { blockType: 'mediaBlock' }>;

// Lexical omits `checked: false` on unchecked checklist items (only
// `checked: true` is ever serialized upstream), so normalize before
// serializing — otherwise an unchecked item is indistinguishable from a
// plain list item.
function normalizeChecklists(node: Record<string, unknown>): void {
  const children = node.children;
  if (!Array.isArray(children)) {
    return;
  }
  if (node.type === 'list' && node.listType === 'check') {
    for (const item of children) {
      if (item && typeof item === 'object') {
        const itemRecord = item as Record<string, unknown>;
        if (itemRecord.checked !== true) {
          itemRecord.checked = false;
        }
      }
    }
  }
  for (const child of children) {
    if (child && typeof child === 'object') {
      normalizeChecklists(child as Record<string, unknown>);
    }
  }
}

// App-specific renderers injected into the shared @revealui/core serializer.
// URL and tag sanitization live in core (and in CMSLink for link URLs) — this
// file owns only the app's block/link/upload presentation.

function renderBlock(
  node: { fields?: Record<string, unknown> },
  index: number,
): JSX.Element | null {
  const block = node.fields;
  const blockType = block?.blockType;

  if (!(block && typeof blockType === 'string')) {
    return null;
  }

  switch (blockType) {
    case 'cta':
      return <CallToActionBlock key={index} {...(block as unknown as CtaBlockFields)} />;
    case 'mediaBlock': {
      // Page layout typing allows id: null; MediaBlock's props do not — drop it
      const { id: _mediaBlockId, ...mediaBlock } = block as unknown as MediaBlockFields;
      return (
        <MediaBlock
          className="col-start-1 col-span-3"
          imgClassName="m-0"
          key={index}
          {...mediaBlock}
          captionClassName="mx-auto max-w-[48rem]"
          enableGutter={false}
          disableInnerContainer={true}
        />
      );
    }
    case 'banner':
      return (
        <BannerBlock
          key={index}
          {...(block as unknown as BannerBlockProps)}
          className="col-start-2 mb-4"
        />
      );
    case 'code':
      return (
        <CodeBlock key={index} {...(block as unknown as CodeBlockProps)} className="col-start-2" />
      );
    default:
      return null;
  }
}

function renderLink(
  node: { fields?: { url?: string; newTab?: boolean; linkType?: string; doc?: unknown } },
  children: JSX.Element | null,
  index: number,
): JSX.Element {
  const fields = node.fields;

  return (
    <CMSLink
      key={index}
      newTab={Boolean(fields?.newTab)}
      reference={fields?.doc as LinkReference | null | undefined}
      type={fields?.linkType === 'internal' ? 'reference' : 'custom'}
      url={fields?.url}
    >
      {children}
    </CMSLink>
  );
}

function renderUpload(
  data: { url?: string; alt?: string; width?: number; height?: number },
  index: number,
): JSX.Element | null {
  if (!data.url) {
    return null;
  }

  return (
    <figure className="col-start-2 my-4" key={index}>
      {data.width && data.height ? (
        <Image
          src={data.url}
          alt={data.alt ?? ''}
          width={data.width}
          height={data.height}
          className="w-full rounded"
        />
      ) : (
        <div className="relative w-full">
          <Image src={data.url} alt={data.alt ?? ''} fill className="rounded object-contain" />
        </div>
      )}
      {data.alt && (
        <figcaption className="mt-2 text-center text-sm text-gray-500">{data.alt}</figcaption>
      )}
    </figure>
  );
}

// Main RichText component — renders through the hardened @revealui/core
// serializer so URL/tag sanitization is structural (one serializer, one
// chokepoint) instead of duplicated per app.
const RichText = ({ className, content, enableGutter = true, enableProse = true }: Props) => {
  if (!content?.root) {
    return null;
  }

  normalizeChecklists(content.root as unknown as Record<string, unknown>);

  return (
    <div
      className={cn(
        {
          container: enableGutter,
          'max-w-none': !enableGutter,
          'mx-auto prose dark:prose-invert': enableProse,
        },
        className,
      )}
    >
      {serializeLexicalState(content as unknown as SerializedEditorState, {
        renderBlock,
        renderLink,
        renderUpload,
      })}
    </div>
  );
};

export default RichText;
