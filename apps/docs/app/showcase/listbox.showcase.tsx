import { Listbox, ListboxLabel, ListboxOption } from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const statuses = [
  { id: 'active', label: 'Active' },
  { id: 'paused', label: 'Paused' },
  { id: 'archived', label: 'Archived' },
  { id: 'draft', label: 'Draft' },
];

const story: ShowcaseStory = {
  slug: 'listbox',
  name: 'Listbox',
  description:
    'Single-select listbox with keyboard navigation. Compound component with ListboxOption.',
  category: 'component',

  controls: {
    placeholder: { type: 'text', default: 'Select status...' },
    disabled: { type: 'boolean', default: false },
  },

  render: (props) => (
    <div className="w-64">
      <Listbox
        placeholder={props.placeholder as string}
        disabled={props.disabled as boolean}
        aria-label="Status"
      >
        {statuses.map((s) => (
          <ListboxOption key={s.id} value={s}>
            <ListboxLabel>{s.label}</ListboxLabel>
          </ListboxOption>
        ))}
      </Listbox>
    </div>
  ),

  examples: [
    {
      name: 'With Default',
      render: () => (
        <div className="w-64">
          <Listbox defaultValue={statuses[0]} aria-label="Status">
            {statuses.map((s) => (
              <ListboxOption key={s.id} value={s}>
                <ListboxLabel>{s.label}</ListboxLabel>
              </ListboxOption>
            ))}
          </Listbox>
        </div>
      ),
    },
    {
      name: 'Disabled',
      render: () => (
        <div className="w-64">
          <Listbox placeholder="Can't select" disabled aria-label="Status">
            {statuses.map((s) => (
              <ListboxOption key={s.id} value={s}>
                <ListboxLabel>{s.label}</ListboxLabel>
              </ListboxOption>
            ))}
          </Listbox>
        </div>
      ),
    },
  ],

  code: (props) =>
    `<Listbox placeholder="${props.placeholder}"${props.disabled ? ' disabled' : ''}>
  <ListboxOption value="active">
    <ListboxLabel>Active</ListboxLabel>
  </ListboxOption>
  <ListboxOption value="paused">
    <ListboxLabel>Paused</ListboxLabel>
  </ListboxOption>
</Listbox>`,
};

export default story;
