import { Badge } from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const badgeIntents = ['brand', 'neutral', 'success', 'warning', 'danger', 'muted'] as const;

const story: ShowcaseStory = {
  slug: 'badge',
  name: 'Badge',
  description: 'Inline status chip. Semantic intents only; colour never encodes meaning alone.',
  category: 'component',

  controls: {
    intent: { type: 'select', options: [...badgeIntents], default: 'neutral' },
    children: { type: 'text', default: 'Badge' },
  },

  render: (props: Record<string, unknown>) => (
    <Badge intent={props.intent as (typeof badgeIntents)[number]}>{props.children as string}</Badge>
  ),

  variantGrid: {
    intent: [...badgeIntents],
  },

  examples: [
    {
      name: 'Status',
      render: () => (
        <div className="flex flex-wrap gap-2">
          <Badge intent="success">Active</Badge>
          <Badge intent="warning">Pending</Badge>
          <Badge intent="danger">Failed</Badge>
          <Badge intent="brand">Info</Badge>
          <Badge intent="neutral">Draft</Badge>
        </div>
      ),
    },
    {
      name: 'Tags',
      render: () => (
        <div className="flex flex-wrap gap-2">
          <Badge intent="brand">AI</Badge>
          <Badge intent="success">OSS</Badge>
          <Badge intent="muted">TypeScript</Badge>
          <Badge intent="brand">Pro</Badge>
        </div>
      ),
    },
  ],

  code: (props: Record<string, unknown>) => {
    const intentAttr = props.intent !== 'neutral' ? ` intent="${props.intent}"` : '';
    return `<Badge${intentAttr}>${props.children}</Badge>`;
  },

  a11y: {
    conformance: ['WCAG 2.2 1.4.1 Use of Color'],
    notes: 'Do not encode meaning only with badge color; include text.',
  },
};

export default story;
