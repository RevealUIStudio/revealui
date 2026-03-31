import { Textarea } from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const story: ShowcaseStory = {
  slug: 'textarea',
  name: 'Textarea',
  description: 'Multi-line text input with consistent styling and focus states.',
  category: 'component',

  controls: {
    placeholder: { type: 'text', default: 'Enter your message...' },
    rows: { type: 'number', default: 4, min: 2, max: 12 },
    disabled: { type: 'boolean', default: false },
  },

  render: (props) => (
    <div className="w-80">
      <Textarea
        placeholder={props.placeholder as string}
        rows={props.rows as number}
        disabled={props.disabled as boolean}
      />
    </div>
  ),

  examples: [
    {
      name: 'With Label',
      render: () => (
        <div className="w-80">
          <label
            htmlFor="desc"
            className="mb-1.5 block text-sm font-medium text-(--rvui-color-text)"
          >
            Description
          </label>
          <Textarea id="desc" placeholder="Describe your project..." rows={3} />
        </div>
      ),
    },
    {
      name: 'Disabled',
      render: () => (
        <div className="w-80">
          <Textarea value="This content cannot be edited." disabled rows={2} />
        </div>
      ),
    },
  ],

  code: (props) => {
    const attrs: string[] = [];
    attrs.push(`placeholder="${props.placeholder}"`);
    if (props.rows !== 4) attrs.push(`rows={${props.rows}}`);
    if (props.disabled) attrs.push('disabled');
    return `<Textarea ${attrs.join(' ')} />`;
  },
};

export default story;
