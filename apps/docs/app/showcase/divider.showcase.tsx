import { Divider } from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const story: ShowcaseStory = {
  slug: 'divider',
  name: 'Divider',
  description: 'Horizontal rule with optional soft variant for lighter separation.',
  category: 'component',

  controls: {
    soft: { type: 'boolean', default: false },
  },

  render: (props: Record<string, unknown>) => (
    <div className="w-80 space-y-4">
      <p className="text-sm text-(--rvui-color-text)">Content above</p>
      <Divider soft={props.soft as boolean} />
      <p className="text-sm text-(--rvui-color-text)">Content below</p>
    </div>
  ),

  examples: [
    {
      name: 'Standard vs Soft',
      render: () => (
        <div className="w-80 space-y-4">
          <p className="text-xs text-(--rvui-color-text-secondary)">Standard</p>
          <Divider />
          <p className="text-xs text-(--rvui-color-text-secondary)">Soft</p>
          <Divider soft />
          <p className="text-xs text-(--rvui-color-text-secondary)">End</p>
        </div>
      ),
    },
  ],

  code: (props: Record<string, unknown>) => `<Divider${props.soft ? ' soft' : ''} />`,

  a11y: {
    conformance: ['WCAG 2.2 1.3.1 Info and Relationships'],
    notes: 'Rendered as hr; decorative separators need no extra label.',
  },
};

export default story;
