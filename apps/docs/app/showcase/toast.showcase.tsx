import { ToastProvider, useToast } from '@revealui/presentation/client';
import { ButtonCVA as Button } from '@revealui/presentation/server';
import type { ShowcaseStory } from '@/components/showcase/types.js';

function ToastDemo(props: Record<string, unknown>) {
  const { addToast } = useToast();
  const variant = props.variant as 'default' | 'success' | 'error' | 'warning' | 'info';
  const title = props.title as string;
  const description = props.description as string;

  return (
    <Button
      onClick={() =>
        addToast({
          title,
          description: description || undefined,
          variant,
        })
      }
    >
      Show Toast
    </Button>
  );
}

function ToastDemoWrapper(props: Record<string, unknown>) {
  return (
    <ToastProvider>
      <ToastDemo {...props} />
    </ToastProvider>
  );
}

function AllVariantsDemo() {
  const { addToast } = useToast();

  return (
    <div className="flex flex-wrap gap-2">
      {(
        [
          {
            variant: 'default',
            label: 'Default',
            title: 'Notification',
            desc: 'Something happened',
          },
          {
            variant: 'success',
            label: 'Success',
            title: 'Saved',
            desc: 'Changes saved successfully',
          },
          { variant: 'error', label: 'Error', title: 'Error', desc: 'Something went wrong' },
          { variant: 'warning', label: 'Warning', title: 'Warning', desc: 'Check your input' },
          { variant: 'info', label: 'Info', title: 'Info', desc: 'FYI  -  new version available' },
        ] as const
      ).map((item) => (
        <Button
          key={item.variant}
          variant="outline"
          onClick={() =>
            addToast({
              title: item.title,
              description: item.desc,
              variant: item.variant,
            })
          }
        >
          {item.label}
        </Button>
      ))}
    </div>
  );
}

const story: ShowcaseStory = {
  slug: 'toast',
  name: 'Toast',
  description:
    'Notification toasts with 5 variants. Auto-dismiss with configurable duration. Managed via useToast hook.',
  category: 'component',

  controls: {
    variant: {
      type: 'select',
      options: ['default', 'success', 'error', 'warning', 'info'],
      default: 'success',
    },
    title: { type: 'text', default: 'Changes saved' },
    description: { type: 'text', default: 'Your settings have been updated.' },
  },

  render: (props) => <ToastDemoWrapper {...props} />,

  examples: [
    {
      name: 'All Variants',
      render: () => (
        <ToastProvider>
          <AllVariantsDemo />
        </ToastProvider>
      ),
    },
  ],

  code: (props) => {
    const attrs: string[] = [`title: '${props.title}'`];
    if (props.description) attrs.push(`description: '${props.description}'`);
    if (props.variant !== 'default') attrs.push(`variant: '${props.variant}'`);
    return `const { addToast } = useToast()

addToast({
  ${attrs.join(',\n  ')},
})`;
  },
};

export default story;
