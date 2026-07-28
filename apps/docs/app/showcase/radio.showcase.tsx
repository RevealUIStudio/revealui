import { Radio, RadioField, RadioGroup } from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const INTENTS = ['brand', 'neutral', 'success', 'warning', 'danger'] as const;

const story: ShowcaseStory = {
  slug: 'radio',
  name: 'Radio',
  description:
    'Radio group with five semantic intents. Compound component: RadioGroup > RadioField > Radio.',
  category: 'component',

  controls: {
    intent: {
      type: 'select',
      options: [...INTENTS],
      default: 'brand',
    },
    disabled: { type: 'boolean', default: false },
  },

  render: (props: Record<string, unknown>) => (
    <RadioGroup defaultValue="option-1" disabled={props.disabled as boolean}>
      {['Option 1', 'Option 2', 'Option 3'].map((label, i) => (
        <RadioField key={label}>
          <Radio intent={props.intent as (typeof INTENTS)[number]} value={`option-${i + 1}`} />
          <span className="text-sm text-foreground">{label}</span>
        </RadioField>
      ))}
    </RadioGroup>
  ),

  examples: [
    {
      name: 'Intents',
      render: () => (
        <div className="flex flex-wrap gap-6">
          {INTENTS.map((intent) => (
            <RadioGroup key={intent} defaultValue="yes">
              <RadioField>
                <Radio intent={intent} value="yes" />
                <span className="text-sm capitalize">{intent}</span>
              </RadioField>
            </RadioGroup>
          ))}
        </div>
      ),
    },
    {
      name: 'Plan Selection',
      render: () => (
        <RadioGroup defaultValue="pro" name="plan">
          {[
            { value: 'free', label: 'Free', desc: 'Basic features' },
            { value: 'pro', label: 'Pro', desc: '$49/mo' },
            { value: 'max', label: 'Max', desc: '$299/mo' },
          ].map((plan) => (
            <RadioField key={plan.value}>
              <Radio intent="brand" value={plan.value} />
              <div>
                <span className="text-sm font-medium text-foreground">{plan.label}</span>
                <span className="ml-2 text-xs text-muted-foreground">{plan.desc}</span>
              </div>
            </RadioField>
          ))}
        </RadioGroup>
      ),
    },
  ],

  code: (props: Record<string, unknown>) =>
    `<RadioGroup defaultValue="option-1"${props.disabled ? ' disabled' : ''}>
  <RadioField>
    <Radio intent="${props.intent}" value="option-1" />
    <span>Option 1</span>
  </RadioField>
  <RadioField>
    <Radio intent="${props.intent}" value="option-2" />
    <span>Option 2</span>
  </RadioField>
</RadioGroup>`,

  a11y: {
    conformance: ['WCAG 2.2 2.1.1 Keyboard', 'WCAG 2.2 4.1.2 Name, Role, Value'],
    keyboard: {
      'Arrow keys': 'Move selection within the group',
      Space: 'Selects the focused radio',
      Tab: 'Moves focus into or out of the group',
    },
    aria: {
      role: 'radio',
      'aria-checked': 'true when selected',
    },
  },
};

export default story;
