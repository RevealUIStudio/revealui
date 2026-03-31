import { Switch } from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const COLORS = [
  'dark/zinc',
  'dark/white',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
] as const;

const story: ShowcaseStory = {
  slug: 'switch',
  name: 'Switch',
  description:
    'Toggle control with 19 color variants. Accessible role="switch" with keyboard support and smooth transitions.',
  category: 'component',

  controls: {
    color: {
      type: 'select',
      options: [...COLORS],
      default: 'dark/zinc',
    },
    defaultChecked: { type: 'boolean', default: true },
    disabled: { type: 'boolean', default: false },
  },

  render: (props) => (
    <Switch
      color={props.color as (typeof COLORS)[number]}
      defaultChecked={props.defaultChecked as boolean}
      disabled={props.disabled as boolean}
    />
  ),

  variantGrid: {
    color: ['blue', 'green', 'red', 'amber', 'violet', 'pink', 'cyan', 'dark/zinc'],
  },

  examples: [
    {
      name: 'Color Palette',
      render: () => (
        <div className="flex flex-wrap gap-4">
          {COLORS.map((color) => (
            <div key={color} className="flex flex-col items-center gap-1">
              <Switch color={color} defaultChecked />
              <span className="text-[10px] font-mono text-zinc-400">{color}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      name: 'States',
      render: () => (
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-center gap-1">
            <Switch color="blue" />
            <span className="text-xs text-zinc-400">Off</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Switch color="blue" defaultChecked />
            <span className="text-xs text-zinc-400">On</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Switch color="blue" disabled />
            <span className="text-xs text-zinc-400">Disabled</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Switch color="blue" defaultChecked disabled />
            <span className="text-xs text-zinc-400">Disabled On</span>
          </div>
        </div>
      ),
    },
  ],

  code: (props) => {
    const attrs: string[] = [];
    if (props.color !== 'dark/zinc') attrs.push(`color="${props.color}"`);
    if (props.defaultChecked) attrs.push('defaultChecked');
    if (props.disabled) attrs.push('disabled');
    const attrStr = attrs.length ? ` ${attrs.join(' ')}` : '';
    return `<Switch${attrStr} />`;
  },
};

export default story;
