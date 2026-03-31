import { Kbd, KbdShortcut } from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const story: ShowcaseStory = {
  slug: 'kbd',
  name: 'Kbd',
  description: 'Keyboard key indicators and shortcut combos with configurable separator.',
  category: 'component',

  controls: {
    separator: { type: 'text', default: '+' },
  },

  render: (props) => (
    <KbdShortcut keys={['Ctrl', 'Shift', 'P']} separator={props.separator as string} />
  ),

  examples: [
    {
      name: 'Single Keys',
      render: () => (
        <div className="flex items-center gap-2">
          <Kbd>Esc</Kbd>
          <Kbd>Tab</Kbd>
          <Kbd>Enter</Kbd>
          <Kbd>Space</Kbd>
        </div>
      ),
    },
    {
      name: 'Common Shortcuts',
      render: () => (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Save</span>
            <KbdShortcut keys={['⌘', 'S']} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Copy</span>
            <KbdShortcut keys={['⌘', 'C']} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Undo</span>
            <KbdShortcut keys={['⌘', 'Z']} />
          </div>
        </div>
      ),
    },
  ],

  code: (props) =>
    `<KbdShortcut keys={['Ctrl', 'Shift', 'P']}${props.separator !== '+' ? ` separator="${props.separator}"` : ''} />`,
};

export default story;
