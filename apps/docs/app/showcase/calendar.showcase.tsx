import { Calendar } from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const story: ShowcaseStory = {
  slug: 'calendar',
  name: 'Calendar',
  description:
    'Month grid for choosing a day. Month navigation, disabled days, and keyboard movement.',
  category: 'component',

  controls: {
    size: {
      type: 'select',
      options: ['sm', 'default', 'lg'],
      default: 'default',
    },
    weekStartsOn: {
      type: 'select',
      options: ['0', '1'],
      default: '0',
    },
  },

  render: (props: Record<string, unknown>) => (
    <Calendar
      defaultMonth={new Date(2026, 8, 1)}
      defaultValue={new Date(2026, 8, 15)}
      size={props.size as 'sm' | 'default' | 'lg'}
      weekStartsOn={props.weekStartsOn === '1' ? 1 : 0}
    />
  ),

  examples: [
    {
      name: 'Bounded range',
      render: () => (
        <Calendar
          defaultMonth={new Date(2026, 8, 1)}
          defaultValue={new Date(2026, 8, 15)}
          max={new Date(2026, 8, 20)}
          min={new Date(2026, 8, 10)}
        />
      ),
    },
  ],

  code: (props: Record<string, unknown>) =>
    `<Calendar defaultMonth={month} defaultValue={day} size="${props.size}" weekStartsOn={${props.weekStartsOn}} />`,

  a11y: {
    conformance: ['WCAG 2.2 2.1.1 Keyboard', 'WCAG 2.2 4.1.2 Name, Role, Value'],
    keyboard: {
      ArrowLeft: 'Move to the previous day',
      ArrowRight: 'Move to the next day',
      ArrowUp: 'Move to the same weekday in the previous week',
      ArrowDown: 'Move to the same weekday in the next week',
      Home: 'Move to the first day of the week',
      End: 'Move to the last day of the week',
      PageUp: 'Move to the same day in the previous month',
      PageDown: 'Move to the same day in the next month',
      Enter: 'Select the focused day',
    },
    aria: {
      role: 'grid',
      'aria-selected': 'true on the selected day',
      'aria-disabled': 'true on days outside min/max or rejected by isDateDisabled',
    },
  },

  sourceUrl: 'src/components/Calendar.tsx',
  related: ['booking-calendar', 'button'],
};

export default story;
