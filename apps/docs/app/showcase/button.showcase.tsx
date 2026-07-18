import { Button, IconArrowRight } from '@revealui/presentation/server';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const story: ShowcaseStory = {
  slug: 'button',
  name: 'Button',
  description:
    'Primary interactive element for actions and form submissions. Two axes: `variant` sets the semantic colour intent, `appearance` sets the visual weight. Both style from design tokens.',
  category: 'component',

  controls: {
    variant: {
      type: 'select',
      options: ['brand', 'neutral', 'success', 'warning', 'danger'],
      default: 'brand',
    },
    appearance: {
      type: 'select',
      options: ['solid', 'outline', 'ghost', 'link'],
      default: 'solid',
    },
    size: {
      type: 'select',
      options: ['default', 'sm', 'lg', 'icon', 'clear'],
      default: 'default',
    },
    isLoading: { type: 'boolean', default: false },
    disabled: { type: 'boolean', default: false },
    glow: { type: 'boolean', default: false },
    shine: { type: 'boolean', default: false },
    children: { type: 'text', default: 'Click me' },
  },

  render: (props: Record<string, unknown>) => (
    <Button
      variant={props.variant as 'brand'}
      appearance={props.appearance as 'solid'}
      size={props.size as 'default'}
      isLoading={props.isLoading as boolean}
      disabled={props.disabled as boolean}
      glow={props.glow as boolean}
      shine={props.shine as boolean}
    >
      {props.children as string}
    </Button>
  ),

  variantGrid: {
    variant: ['brand', 'neutral', 'success', 'warning', 'danger'],
    appearance: ['solid', 'outline', 'ghost', 'link'],
  },

  examples: [
    {
      name: 'With Icon',
      // gap-2 + svg sizing are built into the base, so an icon and a label
      // space correctly with no per-call-site margins.
      render: () => (
        <Button variant="brand">
          Continue
          <IconArrowRight />
        </Button>
      ),
    },
    {
      name: 'Glow (emphasis CTA)',
      // Brand-glow halo driven by the --rvui-shadow-glow token.
      render: () => (
        <Button variant="brand" glow>
          Get started
        </Button>
      ),
    },
    {
      name: 'Shine (hover sweep)',
      // Subtle light sweep on hover; collapses under prefers-reduced-motion.
      render: () => (
        <Button variant="brand" size="lg" shine>
          Upgrade to Pro
        </Button>
      ),
    },
    {
      name: 'Loading State',
      render: () => <Button isLoading>Saving...</Button>,
    },
    {
      name: 'Button Group',
      render: () => (
        <div className="flex gap-2">
          <Button variant="brand">Save</Button>
          <Button appearance="outline" variant="neutral">
            Cancel
          </Button>
          <Button appearance="ghost" variant="neutral">
            Reset
          </Button>
        </div>
      ),
    },
    {
      name: 'Disabled',
      render: () => (
        <div className="flex gap-2">
          <Button disabled>Brand</Button>
          <Button variant="danger" disabled>
            Danger
          </Button>
          <Button appearance="outline" variant="neutral" disabled>
            Outline
          </Button>
        </div>
      ),
    },
  ],

  code: (props: Record<string, unknown>) => {
    const attrs: string[] = [];
    if (props.variant !== 'brand') attrs.push(`variant="${props.variant}"`);
    if (props.appearance !== 'solid') attrs.push(`appearance="${props.appearance}"`);
    if (props.size !== 'default') attrs.push(`size="${props.size}"`);
    if (props.isLoading) attrs.push('isLoading');
    if (props.disabled) attrs.push('disabled');
    if (props.glow) attrs.push('glow');
    if (props.shine) attrs.push('shine');
    const attrStr = attrs.length ? ` ${attrs.join(' ')}` : '';
    return `<Button${attrStr}>${props.children}</Button>`;
  },
};

export default story;
