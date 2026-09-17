import { Select } from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const story: ShowcaseStory = {
  slug: 'select',
  name: 'Select',
  description:
    'Native HTML select (headless + styled). SelectCVA is non-interactive chrome — do not demo it as a form control. Prefer Listbox for fully custom list UIs.',
  category: 'component',

  controls: {
    placeholder: { type: 'text', default: 'Choose a fruit...' },
  },

  render: (props: Record<string, unknown>) => (
    <Select className="w-64" defaultValue="">
      <option value="">{props.placeholder as string}</option>
      <option value="apple">Apple</option>
      <option value="banana">Banana</option>
      <option value="cherry">Cherry</option>
      <option value="grape">Grape</option>
      <option value="mango">Mango</option>
    </Select>
  ),

  examples: [
    {
      name: 'With Default Value',
      render: () => (
        <Select className="w-64" defaultValue="banana">
          <option value="apple">Apple</option>
          <option value="banana">Banana</option>
          <option value="cherry">Cherry</option>
        </Select>
      ),
    },
  ],

  code: (props: Record<string, unknown>) =>
    `<Select className="w-64">
  <option value="">${props.placeholder}</option>
  <option value="apple">Apple</option>
  <option value="banana">Banana</option>
</Select>`,

  a11y: {
    conformance: ['WCAG 2.2 2.1.1 Keyboard', 'WCAG 2.2 4.1.2 Name, Role, Value'],
    keyboard: {
      'Arrow keys': 'Change the selected option',
      Tab: 'Moves focus to the select',
    },
    aria: {
      'aria-invalid': 'Set when validation fails',
    },
    notes:
      'This story uses the native <select> wrapper. SelectCVA is visual chrome only and is not a form control.',
  },
};

export default story;
