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

  render: (props) => (
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

  code: (props) =>
    `<Select>
  <SelectTrigger>
    <SelectValue placeholder="${props.placeholder}" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="apple">Apple</SelectItem>
    <SelectItem value="banana">Banana</SelectItem>
  </SelectContent>
</Select>`,
};

export default story;
