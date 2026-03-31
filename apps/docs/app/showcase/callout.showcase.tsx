import { Callout } from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const story: ShowcaseStory = {
  slug: 'callout',
  name: 'Callout',
  description:
    'Highlighted information block with 5 semantic variants (info, warning, error, success, tip). Supports optional title.',
  category: 'component',

  controls: {
    variant: {
      type: 'select',
      options: ['info', 'warning', 'error', 'success', 'tip'],
      default: 'info',
    },
    title: { type: 'text', default: 'Note' },
    children: { type: 'text', default: 'This is important information you should know about.' },
  },

  render: (props) => (
    <Callout variant={props.variant as 'info'} title={props.title as string}>
      {props.children as string}
    </Callout>
  ),

  variantGrid: {
    variant: ['info', 'warning', 'error', 'success', 'tip'],
  },

  examples: [
    {
      name: 'All Variants',
      render: () => (
        <div className="flex flex-col gap-4">
          <Callout variant="info" title="Information">
            RevealUI uses session-based auth with httpOnly cookies.
          </Callout>
          <Callout variant="success" title="Success">
            Your deployment completed successfully.
          </Callout>
          <Callout variant="warning" title="Warning">
            This action cannot be undone once confirmed.
          </Callout>
          <Callout variant="error" title="Error">
            Failed to connect to the database. Check your credentials.
          </Callout>
          <Callout variant="tip" title="Pro Tip">
            Use <code>pnpm gate</code> to run the full CI pipeline locally.
          </Callout>
        </div>
      ),
    },
    {
      name: 'Without Title',
      render: () => (
        <Callout variant="info">Callouts work without a title for simpler inline notes.</Callout>
      ),
    },
  ],

  code: (props) => {
    const attrs: string[] = [];
    if (props.variant !== 'info') attrs.push(`variant="${props.variant}"`);
    if (props.title) attrs.push(`title="${props.title}"`);
    const attrStr = attrs.length ? ` ${attrs.join(' ')}` : '';
    return `<Callout${attrStr}>${props.children}</Callout>`;
  },
};

export default story;
