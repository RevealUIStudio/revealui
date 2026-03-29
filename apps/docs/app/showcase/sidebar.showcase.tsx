import {
  Sidebar,
  SidebarBody,
  SidebarDivider,
  SidebarFooter,
  SidebarHeader,
  SidebarHeading,
  SidebarItem,
  SidebarLabel,
  SidebarSection,
} from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const story: ShowcaseStory = {
  slug: 'sidebar',
  name: 'Sidebar',
  description: 'Vertical sidebar navigation with header, body, footer, sections, and items.',
  category: 'component',

  controls: {
    activeItem: {
      type: 'select',
      options: ['Dashboard', 'Projects', 'Team', 'Settings'],
      default: 'Dashboard',
    },
  },

  render: (props) => {
    const active = props.activeItem as string;

    return (
      <div className="h-80 w-64 border border-(--rvui-color-border) rounded-lg overflow-hidden">
        <Sidebar>
          <SidebarHeader>
            <span className="text-lg font-semibold">RevealUI</span>
          </SidebarHeader>
          <SidebarBody>
            <SidebarSection>
              <SidebarHeading>Main</SidebarHeading>
              <SidebarItem href="#" current={active === 'Dashboard'}>
                <SidebarLabel>Dashboard</SidebarLabel>
              </SidebarItem>
              <SidebarItem href="#" current={active === 'Projects'}>
                <SidebarLabel>Projects</SidebarLabel>
              </SidebarItem>
              <SidebarItem href="#" current={active === 'Team'}>
                <SidebarLabel>Team</SidebarLabel>
              </SidebarItem>
            </SidebarSection>
            <SidebarDivider />
            <SidebarSection>
              <SidebarHeading>Account</SidebarHeading>
              <SidebarItem href="#" current={active === 'Settings'}>
                <SidebarLabel>Settings</SidebarLabel>
              </SidebarItem>
            </SidebarSection>
          </SidebarBody>
          <SidebarFooter>
            <SidebarItem href="#">
              <SidebarLabel>Sign Out</SidebarLabel>
            </SidebarItem>
          </SidebarFooter>
        </Sidebar>
      </div>
    );
  },

  examples: [
    {
      name: 'Minimal',
      render: () => (
        <div className="h-48 w-56 border border-(--rvui-color-border) rounded-lg overflow-hidden">
          <Sidebar>
            <SidebarBody>
              <SidebarSection>
                <SidebarItem href="#" current>
                  <SidebarLabel>Home</SidebarLabel>
                </SidebarItem>
                <SidebarItem href="#">
                  <SidebarLabel>About</SidebarLabel>
                </SidebarItem>
                <SidebarItem href="#">
                  <SidebarLabel>Contact</SidebarLabel>
                </SidebarItem>
              </SidebarSection>
            </SidebarBody>
          </Sidebar>
        </div>
      ),
    },
  ],

  code: () =>
    `<Sidebar>
  <SidebarHeader>Logo</SidebarHeader>
  <SidebarBody>
    <SidebarSection>
      <SidebarHeading>Main</SidebarHeading>
      <SidebarItem href="/dashboard" current>
        <SidebarLabel>Dashboard</SidebarLabel>
      </SidebarItem>
      <SidebarItem href="/projects">
        <SidebarLabel>Projects</SidebarLabel>
      </SidebarItem>
    </SidebarSection>
  </SidebarBody>
  <SidebarFooter>
    <SidebarItem href="/logout">
      <SidebarLabel>Sign Out</SidebarLabel>
    </SidebarItem>
  </SidebarFooter>
</Sidebar>`,
};

export default story;
