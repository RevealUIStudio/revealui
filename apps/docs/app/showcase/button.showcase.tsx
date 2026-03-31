import { ButtonCVA as Button } from '@revealui/presentation/server';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const story: ShowcaseStory = {
  slug: 'button',
  name: 'Button',
  description:
    'Primary interactive element for actions and form submissions. CVA-powered variants with design token transitions.',
  category: 'component',

  controls: {
    variant: {
      type: 'select',
      options: ['default', 'destructive', 'ghost', 'link', 'outline', 'primary', 'secondary'],
      default: 'default',
    },
    size: {
      type: 'select',
      options: ['default', 'sm', 'lg', 'icon', 'clear'],
      default: 'default',
    },
    isLoading: { type: 'boolean', default: false },
    disabled: { type: 'boolean', default: false },
    children: { type: 'text', default: 'Click me' },
  },

  render: (props) => (
    <Button
      variant={props.variant as 'default'}
      size={props.size as 'default'}
      isLoading={props.isLoading as boolean}
      disabled={props.disabled as boolean}
    >
      {props.children as string}
    </Button>
  ),

  variantGrid: {
    variant: ['default', 'destructive', 'ghost', 'link', 'outline', 'primary', 'secondary'],
    size: ['sm', 'default', 'lg'],
  },

  examples: [
    {
      name: 'Loading State',
      render: () => <Button isLoading>Saving...</Button>,
    },
    {
      name: 'Button Group',
      render: () => (
        <div className="flex gap-2">
          <Button variant="primary">Save</Button>
          <Button variant="outline">Cancel</Button>
          <Button variant="ghost">Reset</Button>
        </div>
      ),
    },
    {
      name: 'Disabled',
      render: () => (
        <div className="flex gap-2">
          <Button disabled>Default</Button>
          <Button variant="destructive" disabled>
            Destructive
          </Button>
          <Button variant="outline" disabled>
            Outline
          </Button>
        </div>
      ),
    },
  ],

  code: (props) => {
    const attrs: string[] = [];
    if (props.variant !== 'default') attrs.push(`variant="${props.variant}"`);
    if (props.size !== 'default') attrs.push(`size="${props.size}"`);
    if (props.isLoading) attrs.push('isLoading');
    if (props.disabled) attrs.push('disabled');
    const attrStr = attrs.length ? ` ${attrs.join(' ')}` : '';
    return `<Button${attrStr}>${props.children}</Button>`;
  },
};

export default story;
