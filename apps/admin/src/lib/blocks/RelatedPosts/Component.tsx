// WIRE-UP-PENDING — this `RelatedPosts` block component has no config file, is
// not offered by any collection's `blocks` field (the Pages editor block list),
// is not referenced by `apps/admin/src/lib/blocks/RenderBlocks.tsx`, and is not
// imported anywhere. Kept on disk pending a per-item register-vs-delete
// decision in PR review.
import type { Post } from '@revealui/core/types/admin';
import { cn } from '@revealui/presentation/server';
import { Card } from '@/lib/components/Card/index';
import RichText from '@/lib/components/RichText/index';
import type { RichTextContent } from '../Form/Component';

export type RelatedPostsProps = {
  className?: string;
  docs?: Post[];
  introContent?: RichTextContent | null;
};

export const RelatedPosts = (props: RelatedPostsProps) => {
  const { className, docs, introContent } = props;

  return (
    <div className={cn('container', className)}>
      {introContent && <RichText content={introContent} enableGutter={false} />}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8 items-stretch">
        {docs?.map((doc) => {
          if (typeof doc === 'string') return null;

          return <Card key={doc.id} doc={doc} relationTo="posts" showCategories />;
        })}
      </div>
    </div>
  );
};
