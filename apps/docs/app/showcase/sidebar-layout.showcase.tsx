import { SidebarLayout, Text } from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const story: ShowcaseStory = {
  slug: 'sidebar-layout',
  name: 'Sidebar Layout',
  description: 'App shell with persistent desktop sidebar and mobile slide-over.',
  category: 'component',
  sourceUrl: 'src/components/sidebar-layout.tsx',
  controls: {},
  render: () => (
    <div className="h-[28rem] w-full overflow-hidden rounded-lg border border-border">
      <SidebarLayout
        navbar={<div className="text-sm font-medium">Workspace</div>}
        sidebar={
          <nav className="flex flex-col gap-2 p-4 text-sm">
            <a href="#home">Home</a>
            <a href="#agents">Agents</a>
          </nav>
        }
      >
        <Text>Main content region.</Text>
      </SidebarLayout>
    </div>
  ),
  code: () => `<SidebarLayout navbar={...} sidebar={...}>{/* page */}</SidebarLayout>`,
  a11y: {
    conformance: ['WCAG 2.2 2.1.1 Keyboard', 'WCAG 2.2 2.4.3 Focus Order'],
    keyboard: {
      Escape: 'Closes the mobile navigation dialog',
    },
    aria: {
      'aria-label': 'Open navigation control on the mobile menu button',
      'aria-modal': 'Mobile nav uses a dialog with focus trap',
    },
  },
};

export default story;
