import { AvatarGroup } from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const teamMembers = [
  { initials: 'JD', alt: 'Jane Doe' },
  { initials: 'AS', alt: 'Alex Smith' },
  { initials: 'MK', alt: 'Maria Kim' },
  { initials: 'TW', alt: 'Tom Wang' },
  { initials: 'RB', alt: 'Rachel Brown' },
  { initials: 'CP', alt: 'Chris Park' },
  { initials: 'LH', alt: 'Lisa Hernandez' },
  { initials: 'DM', alt: 'David Miller' },
];

const story: ShowcaseStory = {
  slug: 'avatar-group',
  name: 'Avatar Group',
  description: 'Stacked avatar display with overflow count, configurable max and sizes.',
  category: 'component',

  controls: {
    max: {
      type: 'range',
      default: 5,
      min: 2,
      max: 8,
      step: 1,
    },
    size: {
      type: 'select',
      options: ['xs', 'sm', 'md', 'lg'],
      default: 'md',
    },
  },

  render: (props) => (
    <AvatarGroup
      items={teamMembers}
      max={props.max as number}
      size={props.size as 'xs' | 'sm' | 'md' | 'lg'}
    />
  ),

  examples: [
    {
      name: 'Sizes',
      render: () => (
        <div className="flex flex-col gap-4">
          <AvatarGroup items={teamMembers.slice(0, 4)} size="xs" />
          <AvatarGroup items={teamMembers.slice(0, 4)} size="sm" />
          <AvatarGroup items={teamMembers.slice(0, 4)} size="md" />
          <AvatarGroup items={teamMembers.slice(0, 4)} size="lg" />
        </div>
      ),
    },
    {
      name: 'With Overflow',
      render: () => <AvatarGroup items={teamMembers} max={3} />,
    },
  ],

  code: (props) => {
    const attrs: string[] = ['items={users}'];
    if (props.max !== 5) attrs.push(`max={${props.max}}`);
    if (props.size !== 'md') attrs.push(`size="${props.size}"`);
    return `<AvatarGroup ${attrs.join(' ')} />`;
  },
};

export default story;
