import { Rating } from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const story: ShowcaseStory = {
  slug: 'rating',
  name: 'Rating',
  description: 'Star rating component with 3 sizes, read-only mode, and configurable max stars.',
  category: 'component',

  controls: {
    size: {
      type: 'select',
      options: ['sm', 'md', 'lg'],
      default: 'md',
    },
    max: {
      type: 'range',
      default: 5,
      min: 3,
      max: 10,
      step: 1,
    },
    readOnly: { type: 'boolean', default: false },
  },

  render: (props) => (
    <Rating
      defaultValue={3}
      max={props.max as number}
      size={props.size as 'sm' | 'md' | 'lg'}
      readOnly={props.readOnly as boolean}
      label="Rating"
    />
  ),

  examples: [
    {
      name: 'Sizes',
      render: () => (
        <div className="flex flex-col gap-4">
          <Rating defaultValue={4} size="sm" label="Small" />
          <Rating defaultValue={4} size="md" label="Medium" />
          <Rating defaultValue={4} size="lg" label="Large" />
        </div>
      ),
    },
    {
      name: 'Read Only',
      render: () => (
        <div className="flex items-center gap-3">
          <Rating value={4.5} readOnly label="Product rating" />
          <span className="text-sm text-(--rvui-color-text-secondary)">4.5 / 5</span>
        </div>
      ),
    },
  ],

  code: (props) => {
    const attrs: string[] = ['defaultValue={3}'];
    if (props.max !== 5) attrs.push(`max={${props.max}}`);
    if (props.size !== 'md') attrs.push(`size="${props.size}"`);
    if (props.readOnly) attrs.push('readOnly');
    attrs.push('label="Rating"');
    return `<Rating ${attrs.join(' ')} />`;
  },
};

export default story;
