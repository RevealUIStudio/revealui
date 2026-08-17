import { Avatar } from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const story: ShowcaseStory = {
  slug: 'avatar',
  name: 'Avatar',
  description:
    'User avatar with image or initials fallback. Supports round and square shapes with outline ring.',
  category: 'component',

  controls: {
    initials: { type: 'text', default: 'JV' },
    square: { type: 'boolean', default: false },
    alt: { type: 'text', default: 'User avatar' },
  },

  render: (props: Record<string, unknown>) => (
    <Avatar
      initials={props.initials as string}
      square={props.square as boolean}
      alt={props.alt as string}
      className="size-12"
    />
  ),

  examples: [
    {
      name: 'Sizes',
      render: () => (
        <div className="flex items-end gap-4">
          {['size-6', 'size-8', 'size-10', 'size-12', 'size-16'].map((size) => (
            <Avatar key={size} initials="JV" alt="Joshua Vaughn" className={size} />
          ))}
        </div>
      ),
    },
    {
      name: 'Initials Gallery',
      render: () => (
        <div className="flex gap-3">
          <Avatar initials="AB" alt="Alice Brown" className="size-10" />
          <Avatar initials="CD" alt="Chris Davis" className="size-10" />
          <Avatar initials="EF" alt="Emma Fischer" className="size-10" />
          <Avatar initials="GH" alt="George Hall" className="size-10" />
          <Avatar initials="JK" alt="Jane Kim" className="size-10" />
        </div>
      ),
    },
    {
      name: 'Square Variant',
      render: () => (
        <div className="flex items-end gap-4">
          <Avatar initials="JV" square alt="Square small" className="size-8" />
          <Avatar initials="JV" square alt="Square medium" className="size-12" />
          <Avatar initials="JV" square alt="Square large" className="size-16" />
        </div>
      ),
    },
  ],

  code: (props: Record<string, unknown>) => {
    const attrs: string[] = [];
    if (props.initials) attrs.push(`initials="${props.initials}"`);
    if (props.square) attrs.push('square');
    if (props.alt) attrs.push(`alt="${props.alt}"`);
    return `<Avatar ${attrs.join(' ')} className="size-12" />`;
  },

  a11y: {
    conformance: ['WCAG 2.2 1.1.1 Non-text Content'],
    aria: {
      alt: 'Required when the avatar is informative',
    },
    notes: 'Decorative avatars should set alt="" or be aria-hidden.',
  },
};

export default story;
