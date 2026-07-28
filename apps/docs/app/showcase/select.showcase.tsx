import {
  SelectCVA as Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const story: ShowcaseStory = {
  slug: 'select',
  name: 'Select',
  description:
    'Compound select component with trigger, content, and items. Supports groups, labels, and separators.',
  category: 'component',

  controls: {
    placeholder: { type: 'text', default: 'Choose a fruit...' },
  },

  render: (props: Record<string, unknown>) => (
    <Select>
      <SelectTrigger className="w-64">
        <SelectValue placeholder={props.placeholder as string} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="apple">Apple</SelectItem>
        <SelectItem value="banana">Banana</SelectItem>
        <SelectItem value="cherry">Cherry</SelectItem>
        <SelectItem value="grape">Grape</SelectItem>
        <SelectItem value="mango">Mango</SelectItem>
      </SelectContent>
    </Select>
  ),

  examples: [
    {
      name: 'With Default Value',
      render: () => (
        <Select value="banana">
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Select fruit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apple">Apple</SelectItem>
            <SelectItem value="banana">Banana</SelectItem>
            <SelectItem value="cherry">Cherry</SelectItem>
          </SelectContent>
        </Select>
      ),
    },
  ],

  code: (props: Record<string, unknown>) =>
    `<Select>
  <SelectTrigger>
    <SelectValue placeholder="${props.placeholder}" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="apple">Apple</SelectItem>
    <SelectItem value="banana">Banana</SelectItem>
  </SelectContent>
</Select>`,,

  a11y: {
    conformance: [
      'WCAG 2.2 2.1.1 Keyboard',
      'WCAG 2.2 4.1.2 Name, Role, Value',
    ],
    keyboard: {
      'Arrow keys': 'Change the selected option',
      Tab: 'Moves focus to the select',
    },
    aria: {
      'aria-invalid': 'Set when validation fails',
    },
    notes: 'Native select semantics; prefer Listbox for fully custom list UIs.',
  },
};

export default story;
