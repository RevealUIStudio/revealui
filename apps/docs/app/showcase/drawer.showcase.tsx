import { Drawer, DrawerBody, DrawerFooter, DrawerHeader } from '@revealui/presentation/client';
import { ButtonCVA as Button } from '@revealui/presentation/server';
import { useState } from 'react';
import type { ShowcaseStory } from '@/components/showcase/types.js';

function DrawerDemo(props: Record<string, unknown>) {
  const [open, setOpen] = useState(false);
  const side = props.side as 'left' | 'right' | 'top' | 'bottom';

  return (
    <>
      <Button onClick={() => setOpen(true)}>Open Drawer</Button>
      <Drawer open={open} onClose={() => setOpen(false)} side={side}>
        <DrawerHeader onClose={() => setOpen(false)}>Drawer Title</DrawerHeader>
        <DrawerBody>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            This drawer slides in from the <strong>{side}</strong> side. It supports focus trapping,
            scroll lock, and escape key dismissal.
          </p>
        </DrawerBody>
        <DrawerFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => setOpen(false)}>
            Save
          </Button>
        </DrawerFooter>
      </Drawer>
    </>
  );
}

const story: ShowcaseStory = {
  slug: 'drawer',
  name: 'Drawer',
  description:
    'Slide-out panel with backdrop, focus trap, scroll lock, and escape key support. Slides from any side.',
  category: 'component',

  controls: {
    side: {
      type: 'select',
      options: ['left', 'right', 'top', 'bottom'],
      default: 'right',
    },
  },

  render: (props) => <DrawerDemo {...props} />,

  examples: [
    {
      name: 'Navigation Drawer',
      render: () => {
        const [open, setOpen] = useState(false);
        return (
          <>
            <Button variant="outline" onClick={() => setOpen(true)}>
              Menu
            </Button>
            <Drawer open={open} onClose={() => setOpen(false)} side="left">
              <DrawerHeader onClose={() => setOpen(false)}>Navigation</DrawerHeader>
              <DrawerBody>
                <nav className="flex flex-col gap-2">
                  {['Dashboard', 'Settings', 'Users', 'Billing', 'Support'].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setOpen(false)}
                      className="rounded-lg px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      {item}
                    </button>
                  ))}
                </nav>
              </DrawerBody>
            </Drawer>
          </>
        );
      },
    },
  ],

  code: (props) => {
    const side = props.side !== 'right' ? ` side="${props.side}"` : '';
    return `<Drawer open={open} onClose={() => setOpen(false)}${side}>
  <DrawerHeader onClose={() => setOpen(false)}>Title</DrawerHeader>
  <DrawerBody>Content here</DrawerBody>
  <DrawerFooter>
    <Button onClick={() => setOpen(false)}>Close</Button>
  </DrawerFooter>
</Drawer>`;
  },
};

export default story;
