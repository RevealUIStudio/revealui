import { Badge } from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const badgeColors = [
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
  'zinc',
];

const story: ShowcaseStory = {
  slug: 'badge',
  name: 'Badge',
  description: 'Inline status indicator with 18 color variants. Uses pill-shaped radius token.',
  category: 'component',

  controls: {
    color: { type: 'select', options: badgeColors, default: 'zinc' },
    children: { type: 'text', default: 'Badge' },
  },

  render: (props) => <Badge color={props.color as 'zinc'}>{props.children as string}</Badge>,

  variantGrid: {
    color: badgeColors,
  },

  examples: [
    {
      name: 'Status Indicators',
      render: () => (
        <div className="flex flex-wrap gap-2">
          <Badge color="green">Active</Badge>
          <Badge color="amber">Pending</Badge>
          <Badge color="red">Failed</Badge>
          <Badge color="blue">Info</Badge>
          <Badge color="zinc">Draft</Badge>
        </div>
      ),
    },
    {
      name: 'Feature Tags',
      render: () => (
        <div className="flex flex-wrap gap-2">
          <Badge color="violet">AI</Badge>
          <Badge color="emerald">OSS</Badge>
          <Badge color="sky">TypeScript</Badge>
          <Badge color="fuchsia">Pro</Badge>
        </div>
      ),
    },
  ],

  code: (props) => {
    const colorAttr = props.color !== 'zinc' ? ` color="${props.color}"` : '';
    return `<Badge${colorAttr}>${props.children}</Badge>`;
  },
};

export default story;
