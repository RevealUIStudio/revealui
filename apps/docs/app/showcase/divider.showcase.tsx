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

  render: (props) => (
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

  code: (props) => `<Divider${props.soft ? ' soft' : ''} />`,
};

export default story;
