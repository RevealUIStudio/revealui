import {
  Navbar,
  NavbarDivider,
  NavbarItem,
  NavbarLabel,
  NavbarSection,
  NavbarSpacer,
} from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const story: ShowcaseStory = {
  slug: 'navbar',
  name: 'Navbar',
  description: 'Horizontal navigation bar with sections, items, labels, dividers, and spacers.',
  category: 'component',

  controls: {
    activeItem: {
      type: 'select',
      options: ['Dashboard', 'Projects', 'Settings'],
      default: 'Dashboard',
    },
  },

  render: (props) => {
    const active = props.activeItem as string;

    return (
      <Navbar>
        <NavbarSection>
          <NavbarItem href="#" current={active === 'Dashboard'}>
            <NavbarLabel>Dashboard</NavbarLabel>
          </NavbarItem>
          <NavbarItem href="#" current={active === 'Projects'}>
            <NavbarLabel>Projects</NavbarLabel>
          </NavbarItem>
          <NavbarItem href="#" current={active === 'Settings'}>
            <NavbarLabel>Settings</NavbarLabel>
          </NavbarItem>
        </NavbarSection>
        <NavbarSpacer />
        <NavbarSection>
          <NavbarItem href="#">
            <NavbarLabel>Profile</NavbarLabel>
          </NavbarItem>
        </NavbarSection>
      </Navbar>
    );
  },

  examples: [
    {
      name: 'With Divider',
      render: () => (
        <Navbar>
          <NavbarSection>
            <NavbarItem href="#" current>
              <NavbarLabel>Home</NavbarLabel>
            </NavbarItem>
            <NavbarItem href="#">
              <NavbarLabel>Docs</NavbarLabel>
            </NavbarItem>
            <NavbarDivider />
            <NavbarItem href="#">
              <NavbarLabel>Blog</NavbarLabel>
            </NavbarItem>
          </NavbarSection>
        </Navbar>
      ),
    },
  ],

  code: () =>
    `<Navbar>
  <NavbarSection>
    <NavbarItem href="/dashboard" current>
      <NavbarLabel>Dashboard</NavbarLabel>
    </NavbarItem>
    <NavbarItem href="/projects">
      <NavbarLabel>Projects</NavbarLabel>
    </NavbarItem>
  </NavbarSection>
  <NavbarSpacer />
  <NavbarSection>
    <NavbarItem href="/profile">
      <NavbarLabel>Profile</NavbarLabel>
    </NavbarItem>
  </NavbarSection>
</Navbar>`,
};

export default story;
