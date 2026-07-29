import { StackedLayout, Text } from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const story: ShowcaseStory = {
  slug: 'stacked-layout',
  name: 'Stacked Layout',
  description: 'App shell with top navbar and mobile slide-over navigation.',
  category: 'component',
  sourceUrl: 'src/components/stacked-layout.tsx',
  controls: {},
  render: () => (
    <div className="h-[28rem] w-full overflow-hidden rounded-lg border border-border">
      <StackedLayout
        navbar={<div className="text-sm font-medium text-foreground">Product</div>}
        sidebar={
          <nav className="flex flex-col gap-2 p-4 text-sm">
            <a href="#overview">Overview</a>
            <a href="#settings">Settings</a>
          </nav>
        }
      >
        <Text>Main content region.</Text>
      </StackedLayout>
    </div>
  ),
  code: () => `<StackedLayout navbar={...} sidebar={...}>{/* page */}</StackedLayout>`,
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
