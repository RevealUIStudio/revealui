import {
  Alert,
  AlertActions,
  AlertBody,
  AlertDescription,
  AlertTitle,
} from '@revealui/presentation/client';
import { ButtonCVA } from '@revealui/presentation/server';
import { useState } from 'react';
import type { ShowcaseStory } from '@/components/showcase/types.js';

function AlertDemo(props: { size: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <ButtonCVA variant="primary" onClick={() => setOpen(true)}>
        Open Alert
      </ButtonCVA>
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
          <ButtonCVA variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </ButtonCVA>
          <ButtonCVA variant="destructive" onClick={() => setOpen(false)}>
            Delete
          </ButtonCVA>
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

  render: (props) => <AlertDemo size={props.size as string} />,

  examples: [
    {
      name: 'Destructive Confirmation',
      render: () => {
        const [open, setOpen] = useState(false);
        return (
          <>
            <ButtonCVA variant="destructive" onClick={() => setOpen(true)}>
              Delete Account
            </ButtonCVA>
            <Alert open={open} onClose={() => setOpen(false)}>
              <AlertTitle>Delete Account?</AlertTitle>
              <AlertDescription>
                This will permanently delete your account and all data.
              </AlertDescription>
              <AlertActions>
                <ButtonCVA variant="ghost" onClick={() => setOpen(false)}>
                  Keep Account
                </ButtonCVA>
                <ButtonCVA variant="destructive" onClick={() => setOpen(false)}>
                  Yes, Delete
                </ButtonCVA>
              </AlertActions>
            </Alert>
          </>
        );
      },
    },
  ],

  code: (props) =>
    `<Alert open={open} onClose={() => setOpen(false)}${props.size !== 'md' ? ` size="${props.size}"` : ''}>
  <AlertTitle>Confirm Action</AlertTitle>
  <AlertDescription>Are you sure?</AlertDescription>
  <AlertActions>
    <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
    <Button variant="destructive" onClick={() => setOpen(false)}>Delete</Button>
  </AlertActions>
</Alert>`,
};

export default story;
