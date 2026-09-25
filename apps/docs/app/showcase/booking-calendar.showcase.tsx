import { BookingCalendar } from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const SLOTS = [
  { start: '2026-09-15T09:00:00', end: '2026-09-15T09:30:00', label: 'Slot A' },
  { start: '2026-09-15T10:00:00', end: '2026-09-15T10:30:00', label: 'Slot B' },
  { start: '2026-09-16T09:00:00', end: '2026-09-16T09:30:00', label: 'Slot C' },
];

const story: ShowcaseStory = {
  slug: 'booking-calendar',
  name: 'Booking Calendar',
  description:
    'Day grid plus the open slots for the selected day, including loading and empty status.',
  category: 'component',

  controls: {
    status: {
      type: 'select',
      options: ['ready', 'loading', 'empty', 'error', 'unconfigured'],
      default: 'ready',
    },
  },

  render: (props: Record<string, unknown>) => (
    <BookingCalendar
      defaultMonth={new Date(2026, 8, 1)}
      defaultSelectedDate={new Date(2026, 8, 15)}
      defaultValue={SLOTS[0]}
      slots={SLOTS}
      status={props.status as 'ready' | 'loading' | 'empty' | 'error' | 'unconfigured'}
    />
  ),

  code: (props: Record<string, unknown>) =>
    `<BookingCalendar status="${props.status}" slots={slots} value={value} onChange={setValue} />`,

  a11y: {
    conformance: ['WCAG 2.2 2.1.1 Keyboard', 'WCAG 2.2 4.1.2 Name, Role, Value'],
    keyboard: {
      'Arrow keys': 'Move between days in the grid, or between slots in the radio group',
      Enter: 'Select the focused day',
      Space: 'Select the focused slot',
    },
    aria: {
      'aria-selected': 'true on the selected day gridcell',
      role: 'radiogroup for the slots of the selected day',
      'aria-busy': 'true while status is loading',
    },
  },

  sourceUrl: 'src/components/BookingCalendar.tsx',
  related: ['calendar', 'radio'],
};

export default story;
