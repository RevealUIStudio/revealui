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

  render: (props) => (
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

  code: (props) => {
    const attrs: string[] = [];
    if (props.type !== 'text') attrs.push(`type="${props.type}"`);
    if (props.placeholder) attrs.push(`placeholder="${props.placeholder}"`);
    if (props.disabled) attrs.push('disabled');
    return `<Input ${attrs.join(' ')} />`;
  },
};

export default story;
