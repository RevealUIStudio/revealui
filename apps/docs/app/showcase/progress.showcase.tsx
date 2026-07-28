import { Progress } from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const INTENTS = ['brand', 'neutral', 'success', 'warning', 'danger'] as const;

const story: ShowcaseStory = {
  slug: 'progress',
  name: 'Progress',
  description:
    'Determinate progress bar with five semantic intents and four sizes. Supports label and percentage display.',
  category: 'component',

  controls: {
    value: {
      type: 'range',
      default: 65,
      min: 0,
      max: 100,
      step: 1,
    },
    intent: {
      type: 'select',
      options: [...INTENTS],
      default: 'brand',
    },
    size: {
      type: 'select',
      options: ['xs', 'sm', 'md', 'lg'],
      default: 'md',
    },
    label: { type: 'text', default: 'Upload progress' },
    showValue: { type: 'boolean', default: true },
  },

  render: (props: Record<string, unknown>) => (
    <div className="w-full max-w-md">
      <Progress
        value={props.value as number}
        intent={props.intent as (typeof INTENTS)[number]}
        size={props.size as 'md'}
        label={props.label as string}
        showValue={props.showValue as boolean}
      />
    </div>
  ),

  variantGrid: {
    intent: [...INTENTS],
    size: ['xs', 'sm', 'md', 'lg'],
  },

  examples: [
    {
      name: 'Upload Progress',
      render: () => (
        <div className="w-full max-w-md">
          <Progress value={73} intent="brand" label="Uploading files..." showValue />
        </div>
      ),
    },
    {
      name: 'Status Indicators',
      render: () => (
        <div className="flex w-full max-w-md flex-col gap-4">
          <Progress value={100} intent="success" size="sm" label="Tests passing" showValue />
          <Progress value={45} intent="warning" size="sm" label="Build progress" showValue />
          <Progress value={12} intent="danger" size="sm" label="Disk usage critical" showValue />
        </div>
      ),
    },
    {
      name: 'Minimal (no label)',
      render: () => (
        <div className="flex w-full max-w-md flex-col gap-3">
          <Progress value={30} intent="brand" size="xs" />
          <Progress value={60} intent="brand" size="sm" />
          <Progress value={90} intent="brand" size="md" />
        </div>
      ),
    },
  ],

  code: (props: Record<string, unknown>) => {
    const attrs: string[] = [`value={${props.value}}`];
    if (props.intent !== 'brand') attrs.push(`intent="${props.intent}"`);
    if (props.size !== 'md') attrs.push(`size="${props.size}"`);
    if (props.label) attrs.push(`label="${props.label}"`);
    if (props.showValue) attrs.push('showValue');
    return `<Progress ${attrs.join(' ')} />`;
  },

  a11y: {
    conformance: ['WCAG 2.2 1.3.1 Info and Relationships', 'WCAG 2.2 4.1.2 Name, Role, Value'],
    aria: {
      role: 'progressbar',
      'aria-valuenow': 'Current progress value',
      'aria-valuemin': '0',
      'aria-valuemax': 'max prop (default 100)',
    },
  },
};

export default story;
