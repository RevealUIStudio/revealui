import { Checkbox, CheckboxField, CheckboxGroup } from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const story: ShowcaseStory = {
  slug: 'checkbox',
  name: 'Checkbox',
  description:
    'Checkbox with support for checked, unchecked, and indeterminate states. 18 color options.',
  category: 'component',

  controls: {
    checked: { type: 'boolean', default: false },
    disabled: { type: 'boolean', default: false },
  },

  render: (props) => (
    // biome-ignore lint/a11y/noLabelWithoutControl: Checkbox uses role="checkbox" (ARIA)
    <label className="flex items-center gap-3">
      <Checkbox checked={props.checked as boolean} disabled={props.disabled as boolean} />
      <span className="text-sm text-(--rvui-color-text)">Accept terms</span>
    </label>
  ),

  examples: [
    {
      name: 'States',
      render: () => (
        <div className="flex items-center gap-6">
          {/* biome-ignore lint/a11y/noLabelWithoutControl: Checkbox uses role="checkbox" (ARIA) */}
          <label className="flex items-center gap-2">
            <Checkbox />
            <span className="text-sm">Unchecked</span>
          </label>
          {/* biome-ignore lint/a11y/noLabelWithoutControl: Checkbox uses role="checkbox" (ARIA) */}
          <label className="flex items-center gap-2">
            <Checkbox checked />
            <span className="text-sm">Checked</span>
          </label>
          {/* biome-ignore lint/a11y/noLabelWithoutControl: Checkbox uses role="checkbox" (ARIA) */}
          <label className="flex items-center gap-2">
            <Checkbox indeterminate />
            <span className="text-sm">Indeterminate</span>
          </label>
          {/* biome-ignore lint/a11y/noLabelWithoutControl: Checkbox uses role="checkbox" (ARIA) */}
          <label className="flex items-center gap-2">
            <Checkbox disabled />
            <span className="text-sm">Disabled</span>
          </label>
        </div>
      ),
    },
    {
      name: 'Form Group',
      render: () => (
        <CheckboxGroup>
          <legend className="mb-2 text-sm font-medium text-(--rvui-color-text)">
            Notifications
          </legend>
          {['Email', 'Push', 'SMS'].map((label) => (
            <CheckboxField key={label}>
              <Checkbox defaultChecked={label === 'Email'} name={label.toLowerCase()} />
              <span className="text-sm text-(--rvui-color-text)">{label}</span>
            </CheckboxField>
          ))}
        </CheckboxGroup>
      ),
    },
  ],

  code: (props) => {
    const attrs: string[] = [];
    if (props.checked) attrs.push('checked');
    if (props.disabled) attrs.push('disabled');
    const attrStr = attrs.length ? ` ${attrs.join(' ')}` : '';
    return `<Checkbox${attrStr} />`;
  },
};

export default story;
