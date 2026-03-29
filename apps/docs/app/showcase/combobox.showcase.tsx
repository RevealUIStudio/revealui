import { Combobox, ComboboxLabel, ComboboxOption } from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const frameworks = [
  { id: 'react', name: 'React' },
  { id: 'vue', name: 'Vue' },
  { id: 'svelte', name: 'Svelte' },
  { id: 'angular', name: 'Angular' },
  { id: 'solid', name: 'Solid' },
  { id: 'qwik', name: 'Qwik' },
  { id: 'astro', name: 'Astro' },
];

const story: ShowcaseStory = {
  slug: 'combobox',
  name: 'Combobox',
  description:
    'Searchable select with typeahead filtering. Supports custom display values and option rendering.',
  category: 'component',

  controls: {
    placeholder: { type: 'text', default: 'Search frameworks...' },
    disabled: { type: 'boolean', default: false },
  },

  render: (props) => (
    <div className="w-72">
      <Combobox
        options={frameworks}
        displayValue={(item) => item?.name ?? ''}
        placeholder={props.placeholder as string}
        disabled={props.disabled as boolean}
      >
        {(fw) => (
          <ComboboxOption key={fw.id} value={fw}>
            <ComboboxLabel>{fw.name}</ComboboxLabel>
          </ComboboxOption>
        )}
      </Combobox>
    </div>
  ),

  examples: [
    {
      name: 'With Default Value',
      render: () => (
        <div className="w-72">
          <Combobox
            options={frameworks}
            displayValue={(item) => item?.name ?? ''}
            value={frameworks[0]}
            placeholder="Select..."
          >
            {(fw) => (
              <ComboboxOption key={fw.id} value={fw}>
                <ComboboxLabel>{fw.name}</ComboboxLabel>
              </ComboboxOption>
            )}
          </Combobox>
        </div>
      ),
    },
  ],

  code: (props) =>
    `<Combobox
  options={items}
  displayValue={(item) => item.name}
  placeholder="${props.placeholder}"${props.disabled ? '\n  disabled' : ''}
>
  {(options) => options.map((item) => (
    <ComboboxOption key={item.id} value={item}>
      <ComboboxLabel>{item.name}</ComboboxLabel>
    </ComboboxOption>
  ))}
</Combobox>`,
};

export default story;
