import { Skeleton, SkeletonCard, SkeletonText } from '@revealui/presentation/server';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const story: ShowcaseStory = {
  slug: 'skeleton',
  name: 'Skeleton',
  description:
    'Loading placeholder components: basic Skeleton, SkeletonText with configurable lines, and SkeletonCard.',
  category: 'component',

  controls: {
    variant: {
      type: 'select',
      options: ['basic', 'text', 'card'],
      default: 'basic',
    },
    lines: {
      type: 'range',
      default: 3,
      min: 1,
      max: 8,
      step: 1,
    },
  },

  render: (props) => {
    const variant = props.variant as string;

    if (variant === 'text') {
      return <SkeletonText lines={props.lines as number} className="w-72" />;
    }
    if (variant === 'card') {
      return <SkeletonCard className="w-72" />;
    }
    return (
      <div className="flex flex-col gap-3 w-72">
        <Skeleton className="h-4 w-full rounded" />
        <Skeleton className="h-4 w-3/4 rounded" />
        <Skeleton className="h-4 w-1/2 rounded" />
      </div>
    );
  },

  examples: [
    {
      name: 'Text Loading',
      render: () => <SkeletonText lines={4} className="w-80" />,
    },
    {
      name: 'Card Loading',
      render: () => (
        <div className="flex gap-4">
          <SkeletonCard className="w-64" />
          <SkeletonCard className="w-64" />
        </div>
      ),
    },
    {
      name: 'Profile Placeholder',
      render: () => (
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-32 rounded" />
            <Skeleton className="h-3 w-24 rounded" />
          </div>
        </div>
      ),
    },
  ],

  code: (props) => {
    if (props.variant === 'text') return `<SkeletonText lines={${props.lines}} />`;
    if (props.variant === 'card') return `<SkeletonCard />`;
    return `<Skeleton className="h-4 w-full rounded" />`;
  },
};

export default story;
