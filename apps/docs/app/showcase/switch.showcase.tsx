import { Switch } from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const INTENTS = ['brand', 'neutral', 'success', 'warning', 'danger'] as const;

const story: ShowcaseStory = {
  slug: 'switch',
  name: 'Switch',
  description:
    'Toggle control with five semantic intents (brand, neutral, success, warning, danger). Accessible role="switch" with keyboard support.',
  category: 'component',

  controls: {
    intent: {
      type: 'select',
      options: [...INTENTS],
      default: 'brand',
    },
    defaultChecked: { type: 'boolean', default: true },
    disabled: { type: 'boolean', default: false },
  },

  render: (props: Record<string, unknown>) => (
    <Switch
      intent={props.intent as (typeof INTENTS)[number]}
      defaultChecked={props.defaultChecked as boolean}
      disabled={props.disabled as boolean}
    />
  ),

  variantGrid: {
    intent: [...INTENTS],
  },

  examples: [
    {
      name: 'Intents',
      render: () => (
        <div className="flex flex-wrap gap-4">
          {INTENTS.map((intent) => (
            <div key={intent} className="flex flex-col items-center gap-1">
              <Switch intent={intent} defaultChecked />
              <span className="font-mono text-[10px] text-muted-foreground">{intent}</span>
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
            <Switch intent="brand" />
            <span className="text-xs text-muted-foreground">Off</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Switch intent="brand" defaultChecked />
            <span className="text-xs text-muted-foreground">On</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Switch intent="brand" disabled />
            <span className="text-xs text-muted-foreground">Disabled</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Switch intent="brand" defaultChecked disabled />
            <span className="text-xs text-muted-foreground">Disabled On</span>
          </div>
        </div>
      ),
    },
  ],

  code: (props: Record<string, unknown>) => {
    const attrs: string[] = [];
    if (props.intent !== 'brand') attrs.push(`intent="${props.intent}"`);
    if (props.defaultChecked) attrs.push('defaultChecked');
    if (props.disabled) attrs.push('disabled');
    const attrStr = attrs.length ? ` ${attrs.join(' ')}` : '';
    return `<Switch${attrStr} />`;
  },

  a11y: {
    conformance: ['WCAG 2.2 2.1.1 Keyboard', 'WCAG 2.2 4.1.2 Name, Role, Value'],
    keyboard: {
      Space: 'Toggles on/off',
      Enter: 'Toggles on/off',
      Tab: 'Moves focus to the switch',
    },
    aria: {
      role: 'switch',
      'aria-checked': 'true when on',
    },
  },
};

export default story;
