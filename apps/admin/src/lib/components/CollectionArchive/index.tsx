import type { Post } from '@revealui/core/types/cms';
import { cn } from '@/lib/styles/classnames';
import { Card } from '../Card/index';

export type Props = {
  posts: Post[];
};

export const CollectionArchive = (props: Props) => {
  const { posts } = props;

  return (
    <div className={cn('container')}>
      <div>
        <div className="grid grid-cols-4 sm:grid-cols-8 lg:grid-cols-12 gap-4 lg:gap-8 xl:gap-x-8">
          {posts?.map((result) => {
            if (typeof result === 'object' && result !== null) {
              return (
                <div className="col-span-4" key={result.id}>
                  <Card className="h-full" doc={result} relationTo="posts" showCategories />
                </div>
              );
            }

            return null;
          })}
        </div>
      </div>
    </div>
  );
};
