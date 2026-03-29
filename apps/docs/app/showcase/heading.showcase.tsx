import { Heading, Subheading } from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const story: ShowcaseStory = {
  slug: 'heading',
  name: 'Heading',
  description: 'Semantic heading and subheading components with configurable level (h1-h6).',
  category: 'component',

  controls: {
    level: {
      type: 'select',
      options: ['1', '2', '3', '4', '5', '6'],
      default: '1',
    },
    children: { type: 'text', default: 'Page Title' },
  },

  render: (props) => (
    <div>
      <Heading level={Number(props.level) as 1 | 2 | 3 | 4 | 5 | 6}>
        {props.children as string}
      </Heading>
    </div>
  ),

  examples: [
    {
      name: 'Heading Levels',
      render: () => (
        <div className="flex flex-col gap-3">
          <Heading level={1}>Heading 1</Heading>
          <Heading level={2}>Heading 2</Heading>
          <Heading level={3}>Heading 3</Heading>
          <Heading level={4}>Heading 4</Heading>
        </div>
      ),
    },
    {
      name: 'With Subheading',
      render: () => (
        <div className="flex flex-col gap-1">
          <Heading>Dashboard</Heading>
          <Subheading>Overview of your project metrics</Subheading>
        </div>
      ),
    },
  ],

  code: (props) => `<Heading level={${props.level}}>${props.children}</Heading>`,
};

export default story;
