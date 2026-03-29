import { Radio, RadioField, RadioGroup } from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const story: ShowcaseStory = {
  slug: 'radio',
  name: 'Radio',
  description:
    'Radio group with 18 color options. Compound component: RadioGroup > RadioField > Radio.',
  category: 'component',

  controls: {
    color: {
      type: 'select',
      options: [
        'dark/zinc',
        'blue',
        'red',
        'green',
        'purple',
        'amber',
        'pink',
        'teal',
        'indigo',
        'cyan',
      ],
      default: 'dark/zinc',
    },
    disabled: { type: 'boolean', default: false },
  },

  render: (props) => (
    <RadioGroup defaultValue="option-1" disabled={props.disabled as boolean}>
      {['Option 1', 'Option 2', 'Option 3'].map((label, i) => (
        <RadioField key={label}>
          <Radio color={props.color as 'blue'} value={`option-${i + 1}`} />
          <span className="text-sm text-(--rvui-color-text)">{label}</span>
        </RadioField>
      ))}
    </RadioGroup>
  ),

  examples: [
    {
      name: 'Color Palette',
      render: () => {
        const colors = [
          'blue',
          'red',
          'green',
          'purple',
          'amber',
          'pink',
          'teal',
          'indigo',
        ] as const;
        return (
          <div className="flex flex-wrap gap-6">
            {colors.map((color) => (
              <RadioGroup key={color} defaultValue="yes">
                <RadioField>
                  <Radio color={color} value="yes" />
                  <span className="text-sm capitalize">{color}</span>
                </RadioField>
              </RadioGroup>
            ))}
          </div>
        );
      },
    },
    {
      name: 'Plan Selection',
      render: () => (
        <RadioGroup defaultValue="pro" name="plan">
          {[
            { value: 'free', label: 'Free', desc: 'Basic features' },
            { value: 'pro', label: 'Pro', desc: '$49/mo' },
            { value: 'max', label: 'Max', desc: '$149/mo' },
          ].map((plan) => (
            <RadioField key={plan.value}>
              <Radio color="blue" value={plan.value} />
              <div>
                <span className="text-sm font-medium text-(--rvui-color-text)">{plan.label}</span>
                <span className="ml-2 text-xs text-(--rvui-color-text-secondary)">{plan.desc}</span>
              </div>
            </RadioField>
          ))}
        </RadioGroup>
      ),
    },
  ],

  code: (props) =>
    `<RadioGroup defaultValue="option-1"${props.disabled ? ' disabled' : ''}>
  <RadioField>
    <Radio color="${props.color}" value="option-1" />
    <span>Option 1</span>
  </RadioField>
  <RadioField>
    <Radio color="${props.color}" value="option-2" />
    <span>Option 2</span>
  </RadioField>
</RadioGroup>`,
};

export default story;
