import {
  Alert,
  AlertActions,
  AlertBody,
  AlertDescription,
  AlertTitle,
} from '@revealui/presentation/client';
import { Button } from '@revealui/presentation/server';
import { useState } from 'react';
import type { ShowcaseStory } from '@/components/showcase/types.js';

function AlertDemo(props: { size: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="brand" onClick={() => setOpen(true)}>
        Open Alert
      </Button>
      <Alert open={open} onClose={() => setOpen(false)} size={props.size as 'sm' | 'md' | 'lg'}>
        <AlertTitle>Confirm Action</AlertTitle>
        <AlertDescription>
          Are you sure you want to proceed? This action cannot be undone.
        </AlertDescription>
        <AlertBody>
          <p className="text-sm text-(--rvui-color-text-secondary)">
            All associated data will be permanently removed.
          </p>
        </AlertBody>
        <AlertActions>
          <Button appearance="ghost" variant="neutral" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => setOpen(false)}>
            Delete
          </Button>
        </AlertActions>
      </Alert>
    </>
  );
}

const story: ShowcaseStory = {
  slug: 'alert',
  name: 'Alert',
  description: 'Modal alert dialog with title, description, body, and action buttons.',
  category: 'component',

  controls: {
    size: {
      type: 'select',
      options: ['sm', 'md', 'lg', '2xl'],
      default: 'md',
    },
  },

  render: (props: Record<string, unknown>) => <AlertDemo size={props.size as string} />,

  examples: [
    {
      name: 'Destructive Confirmation',
      render: () => {
        const [open, setOpen] = useState(false);
        return (
          <>
            <Button variant="danger" onClick={() => setOpen(true)}>
              Delete Account
            </Button>
            <Alert open={open} onClose={() => setOpen(false)}>
              <AlertTitle>Delete Account?</AlertTitle>
              <AlertDescription>
                This will permanently delete your account and all data.
              </AlertDescription>
              <AlertActions>
                <Button appearance="ghost" variant="neutral" onClick={() => setOpen(false)}>
                  Keep Account
                </Button>
                <Button variant="danger" onClick={() => setOpen(false)}>
                  Yes, Delete
                </Button>
              </AlertActions>
            </Alert>
          </>
        );
      },
    },
  ],

  code: (props: Record<string, unknown>) =>
    `<Alert open={open} onClose={() => setOpen(false)}${props.size !== 'md' ? ` size="${props.size}"` : ''}>
  <AlertTitle>Confirm Action</AlertTitle>
  <AlertDescription>Are you sure?</AlertDescription>
  <AlertActions>
    <Button appearance="ghost" variant="neutral" onClick={() => setOpen(false)}>Cancel</Button>
    <Button variant="danger" onClick={() => setOpen(false)}>Delete</Button>
  </AlertActions>
</Alert>`,

  a11y: {
    conformance: ['WCAG 2.2 2.1.1 Keyboard', 'WCAG 2.2 4.1.2 Name, Role, Value'],
    keyboard: {
      Escape: 'Dismisses when dismissible',
    },
    aria: {
      role: 'alertdialog or dialog depending on composition',
    },
  },
};

export default story;
