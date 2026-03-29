import { Stepper } from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const story: ShowcaseStory = {
  slug: 'stepper',
  name: 'Stepper',
  description:
    'Step indicator with horizontal/vertical orientation. Steps have complete, current, or upcoming status.',
  category: 'component',

  controls: {
    orientation: {
      type: 'select',
      options: ['horizontal', 'vertical'],
      default: 'horizontal',
    },
    currentStep: {
      type: 'range',
      default: 2,
      min: 1,
      max: 4,
      step: 1,
    },
  },

  render: (props) => {
    const current = props.currentStep as number;
    const steps = [
      { label: 'Account', description: 'Create your account' },
      { label: 'Profile', description: 'Set up your profile' },
      { label: 'Payment', description: 'Add payment method' },
      { label: 'Confirm', description: 'Review and confirm' },
    ].map((s, i) => ({
      ...s,
      status: (i + 1 < current ? 'complete' : i + 1 === current ? 'current' : 'upcoming') as
        | 'complete'
        | 'current'
        | 'upcoming',
    }));

    return <Stepper steps={steps} orientation={props.orientation as 'horizontal' | 'vertical'} />;
  },

  examples: [
    {
      name: 'Vertical',
      render: () => (
        <Stepper
          orientation="vertical"
          steps={[
            { label: 'Order placed', status: 'complete' },
            { label: 'Processing', status: 'complete' },
            { label: 'Shipped', status: 'current', description: 'In transit' },
            { label: 'Delivered', status: 'upcoming' },
          ]}
        />
      ),
    },
  ],

  code: (props) =>
    `<Stepper
  orientation="${props.orientation}"
  steps={[
    { label: 'Step 1', status: 'complete' },
    { label: 'Step 2', status: 'current' },
    { label: 'Step 3', status: 'upcoming' },
  ]}
/>`,
};

export default story;
