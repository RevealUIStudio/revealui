import {
  Dropdown,
  DropdownButton,
  DropdownDivider,
  DropdownItem,
  DropdownMenu,
  DropdownShortcut,
} from '@revealui/presentation/client';
import { ButtonCVA as Button } from '@revealui/presentation/server';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const story: ShowcaseStory = {
  slug: 'dropdown',
  name: 'Dropdown',
  description: 'Dropdown menu with items, dividers, shortcuts, and portal rendering.',
  category: 'component',

  controls: {
    anchor: {
      type: 'select',
      options: ['bottom', 'top'],
      default: 'bottom',
    },
  },

  render: (props) => (
    <Dropdown>
      <DropdownButton as={Button}>Actions</DropdownButton>
      <DropdownMenu anchor={props.anchor as 'bottom' | 'top'}>
        <DropdownItem>
          Edit
          <DropdownShortcut keys={['Ctrl', 'E']} />
        </DropdownItem>
        <DropdownItem>
          Duplicate
          <DropdownShortcut keys={['Ctrl', 'D']} />
        </DropdownItem>
        <DropdownDivider />
        <DropdownItem>
          Delete
          <DropdownShortcut keys={['Del']} />
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  ),

  examples: [
    {
      name: 'With Links',
      render: () => (
        <Dropdown>
          <DropdownButton as={Button} variant="outline">
            Navigation
          </DropdownButton>
          <DropdownMenu>
            <DropdownItem href="#">Dashboard</DropdownItem>
            <DropdownItem href="#">Settings</DropdownItem>
            <DropdownItem href="#">Profile</DropdownItem>
            <DropdownDivider />
            <DropdownItem href="#">Sign out</DropdownItem>
          </DropdownMenu>
        </Dropdown>
      ),
    },
  ],

  code: (props) =>
    `<Dropdown>
  <DropdownButton as={Button}>Actions</DropdownButton>
  <DropdownMenu anchor="${props.anchor}">
    <DropdownItem>Edit<DropdownShortcut keys={['Ctrl', 'E']} /></DropdownItem>
    <DropdownDivider />
    <DropdownItem>Delete</DropdownItem>
  </DropdownMenu>
</Dropdown>`,
};

export default story;
