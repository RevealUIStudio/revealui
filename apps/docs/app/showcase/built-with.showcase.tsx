import { BuiltWithRevealUI } from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const story: ShowcaseStory = {
  slug: 'built-with',
  name: 'Built With RevealUI',
  description:
    'An attribution badge linking back to revealui.com. Ships full (mark + label) or logo-only, in light or dark color schemes, and can be pinned to a page corner or rendered inline.',
  category: 'component',
  sourceUrl: 'src/components/BuiltWithRevealUI.tsx',

  controls: {
    variant: { type: 'select', options: ['full', 'logo'], default: 'full' },
    colorScheme: { type: 'select', options: ['light', 'dark'], default: 'light' },
    size: { type: 'select', options: ['sm', 'md'], default: 'sm' },
  },

  render: (props: Record<string, unknown>) => (
    <BuiltWithRevealUI
      variant={props.variant as 'full'}
      colorScheme={props.colorScheme as 'light'}
      size={props.size as 'sm'}
      position="inline"
    />
  ),

  examples: [
    {
      name: 'Variants and schemes',
      render: () => (
        <div className="flex flex-wrap items-center gap-4">
          <BuiltWithRevealUI variant="full" colorScheme="light" position="inline" />
          <BuiltWithRevealUI variant="full" colorScheme="dark" position="inline" />
          <BuiltWithRevealUI variant="logo" colorScheme="light" position="inline" />
          <BuiltWithRevealUI variant="logo" colorScheme="dark" position="inline" />
        </div>
      ),
    },
  ],

  a11y: {
    notes:
      'Renders as an anchor to revealui.com with rel="noopener noreferrer". The mark is decorative; the "Built with RevealUI" text carries the accessible name in the full variant, so prefer full for standalone placements.',
  },

  usage: {
    when: 'Free-tier attribution in a page footer or corner.',
    avoid:
      'Do not use the fixed `position` variants inside scrollable content or dialogs — they pin to the viewport.',
  },

  code: (props: Record<string, unknown>) =>
    `<BuiltWithRevealUI variant="${props.variant}" colorScheme="${props.colorScheme}" size="${props.size}" position="inline" />`,
};

export default story;
