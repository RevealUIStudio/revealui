import { Progress } from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const story: ShowcaseStory = {
  slug: 'progress',
  name: 'Progress',
  description:
    'Determinate progress bar with 6 colors and 4 sizes. Supports label and percentage display.',
  category: 'component',

  controls: {
    value: {
      type: 'range',
      default: 65,
      min: 0,
      max: 100,
      step: 1,
    },
    color: {
      type: 'select',
      options: ['blue', 'green', 'red', 'amber', 'violet', 'zinc'],
      default: 'blue',
    },
    size: {
      type: 'select',
      options: ['xs', 'sm', 'md', 'lg'],
      default: 'md',
    },
    label: { type: 'text', default: 'Upload progress' },
    showValue: { type: 'boolean', default: true },
  },

  render: (props) => (
    <div className="w-full max-w-md">
      <Progress
        value={props.value as number}
        color={props.color as 'blue'}
        size={props.size as 'md'}
        label={props.label as string}
        showValue={props.showValue as boolean}
      />
    </div>
  ),

  variantGrid: {
    color: ['blue', 'green', 'red', 'amber', 'violet', 'zinc'],
    size: ['xs', 'sm', 'md', 'lg'],
  },

  examples: [
    {
      name: 'Upload Progress',
      render: () => (
        <div className="w-full max-w-md">
          <Progress value={73} color="blue" label="Uploading files..." showValue />
        </div>
      ),
    },
    {
      name: 'Status Indicators',
      render: () => (
        <div className="flex w-full max-w-md flex-col gap-4">
          <Progress value={100} color="green" size="sm" label="Tests passing" showValue />
          <Progress value={45} color="amber" size="sm" label="Build progress" showValue />
          <Progress value={12} color="red" size="sm" label="Disk usage critical" showValue />
        </div>
      ),
    },
    {
      name: 'Minimal (no label)',
      render: () => (
        <div className="flex w-full max-w-md flex-col gap-3">
          <Progress value={30} color="violet" size="xs" />
          <Progress value={60} color="violet" size="sm" />
          <Progress value={90} color="violet" size="md" />
        </div>
      ),
    },
  ],

  code: (props) => {
    const attrs: string[] = [`value={${props.value}}`];
    if (props.color !== 'blue') attrs.push(`color="${props.color}"`);
    if (props.size !== 'md') attrs.push(`size="${props.size}"`);
    if (props.label) attrs.push(`label="${props.label}"`);
    if (props.showValue) attrs.push('showValue');
    return `<Progress ${attrs.join(' ')} />`;
  },
};

export default story;
