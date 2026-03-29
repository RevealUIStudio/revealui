import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@revealui/presentation/client';
import { ButtonCVA as Button } from '@revealui/presentation/server';
import { useState } from 'react';
import type { ShowcaseStory } from '@/components/showcase/types.js';

function DialogDemo(props: Record<string, unknown>) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        Open Dialog
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} size={props.size as 'lg'}>
        <DialogTitle>{props.title as string}</DialogTitle>
        <DialogDescription>{props.description as string}</DialogDescription>
        <DialogBody>
          <p className="text-sm" style={{ color: 'var(--rvui-text-1, inherit)' }}>
            {props.body as string}
          </p>
        </DialogBody>
        <DialogActions>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => setOpen(false)}>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

const story: ShowcaseStory = {
  slug: 'dialog',
  name: 'Dialog',
  description:
    'Modal overlay with focus trap, scroll lock, and escape key handling. Spring-based transitions with OKLCH backdrop.',
  category: 'component',

  controls: {
    size: {
      type: 'select',
      options: ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl'],
      default: 'lg',
    },
    title: { type: 'text', default: 'Confirm Action' },
    description: { type: 'text', default: 'Are you sure you want to proceed?' },
    body: {
      type: 'text',
      default: 'This action cannot be undone. Please review before confirming.',
    },
  },

  render: (props) => <DialogDemo {...props} />,

  examples: [
    {
      name: 'Small Confirmation',
      render: () => {
        function SmallDialog() {
          const [open, setOpen] = useState(false);
          return (
            <>
              <Button variant="destructive" onClick={() => setOpen(true)}>
                Delete Item
              </Button>
              <Dialog open={open} onClose={() => setOpen(false)} size="sm">
                <DialogTitle>Delete this item?</DialogTitle>
                <DialogDescription>
                  This will permanently remove the item from your account.
                </DialogDescription>
                <DialogActions>
                  <Button variant="outline" onClick={() => setOpen(false)}>
                    Keep it
                  </Button>
                  <Button variant="destructive" onClick={() => setOpen(false)}>
                    Delete
                  </Button>
                </DialogActions>
              </Dialog>
            </>
          );
        }
        return <SmallDialog />;
      },
    },
  ],

  code: (props) => {
    const sizeAttr = props.size !== 'lg' ? ` size="${props.size}"` : '';
    return [
      `<Dialog open={open} onClose={() => setOpen(false)}${sizeAttr}>`,
      `  <DialogTitle>${props.title}</DialogTitle>`,
      `  <DialogDescription>${props.description}</DialogDescription>`,
      '  <DialogBody>',
      `    <p>${props.body}</p>`,
      '  </DialogBody>',
      '  <DialogActions>',
      '    <Button variant="outline" onClick={onClose}>Cancel</Button>',
      '    <Button variant="primary" onClick={onConfirm}>Confirm</Button>',
      '  </DialogActions>',
      '</Dialog>',
    ].join('\n');
  },
};

export default story;
