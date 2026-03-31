import { Code, Strong, Text, TextLink } from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const story: ShowcaseStory = {
  slug: 'text',
  name: 'Text',
  description: 'Typography primitives: Text (paragraph), TextLink, Strong, and Code.',
  category: 'component',

  controls: {
    variant: {
      type: 'select',
      options: ['text', 'strong', 'code', 'link'],
      default: 'text',
    },
    children: { type: 'text', default: 'The quick brown fox jumps over the lazy dog.' },
  },

  render: (props) => {
    const variant = props.variant as string;
    const content = props.children as string;

    if (variant === 'strong')
      return (
        <Text>
          <Strong>{content}</Strong>
        </Text>
      );
    if (variant === 'code')
      return (
        <Text>
          <Code>{content}</Code>
        </Text>
      );
    if (variant === 'link')
      return (
        <Text>
          <TextLink href="#">{content}</TextLink>
        </Text>
      );
    return <Text>{content}</Text>;
  },

  examples: [
    {
      name: 'All Variants',
      render: () => (
        <div className="flex flex-col gap-3">
          <Text>Regular text paragraph with default styling.</Text>
          <Text>
            <Strong>Bold text</Strong> mixed with regular text.
          </Text>
          <Text>
            Inline <Code>code snippets</Code> within text.
          </Text>
          <Text>
            Visit <TextLink href="#">the documentation</TextLink> for details.
          </Text>
        </div>
      ),
    },
    {
      name: 'Mixed Content',
      render: () => (
        <Text>
          Install RevealUI with <Code>npx create-revealui</Code> and follow the{' '}
          <TextLink href="#">quick-start guide</TextLink>. For <Strong>production</Strong>{' '}
          deployments, see the deployment docs.
        </Text>
      ),
    },
  ],

  code: (props) => {
    const variant = props.variant as string;
    const content = props.children as string;
    if (variant === 'strong') return `<Text><Strong>${content}</Strong></Text>`;
    if (variant === 'code') return `<Text><Code>${content}</Code></Text>`;
    if (variant === 'link') return `<Text><TextLink href="#">${content}</TextLink></Text>`;
    return `<Text>${content}</Text>`;
  },
};

export default story;
