import { InputCVA as Input } from '@revealui/presentation/server';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const story: ShowcaseStory = {
  slug: 'input',
  name: 'Input',
  description: 'Text input with token-based border radius and focus transitions.',
  category: 'component',

  controls: {
    type: {
      type: 'select',
      options: ['text', 'email', 'password', 'number', 'search', 'url'],
      default: 'text',
    },
    placeholder: { type: 'text', default: 'Enter text...' },
    disabled: { type: 'boolean', default: false },
  },

  render: (props: Record<string, unknown>) => (
    <Input
      type={props.type as string}
      placeholder={props.placeholder as string}
      disabled={props.disabled as boolean}
      className="max-w-xs"
    />
  ),

  examples: [
    {
      name: 'Input Types',
      render: () => (
        <div className="flex flex-col gap-3 w-72">
          <Input type="text" placeholder="Name" />
          <Input type="email" placeholder="email@example.com" />
          <Input type="password" placeholder="Password" />
          <Input type="number" placeholder="0" />
          <Input type="search" placeholder="Search..." />
        </div>
      ),
    },
    {
      name: 'Disabled',
      render: () => <Input disabled placeholder="Disabled input" className="max-w-xs" />,
    },
  ],

  code: (props: Record<string, unknown>) => {
    const attrs: string[] = [];
    if (props.type !== 'text') attrs.push(`type="${props.type}"`);
    if (props.placeholder) attrs.push(`placeholder="${props.placeholder}"`);
    if (props.disabled) attrs.push('disabled');
    return `<Input ${attrs.join(' ')} />`;
  },

  a11y: {
    conformance: [
      'WCAG 2.2 1.3.1 Info and Relationships',
      'WCAG 2.2 2.1.1 Keyboard',
      'WCAG 2.2 3.3.2 Labels or Instructions',
      'WCAG 2.2 4.1.2 Name, Role, Value',
    ],
    keyboard: {
      Tab: 'Moves focus into and out of the field',
    },
    aria: {
      'aria-invalid': 'Set when validation fails',
      'aria-disabled': 'Reflects disabled state',
    },
    notes: 'Pair with FormLabel or FormField for a visible name.',
  },
};

export default story;
