import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { BookingCalendar, type BookingSlot } from '../../components/BookingCalendar.js';

const SEPTEMBER = new Date(2026, 8, 1);

const SLOTS: BookingSlot[] = [
  {
    end: '2026-09-15T09:30:00',
    label: 'Slot A',
    start: '2026-09-15T09:00:00',
  },
  {
    end: '2026-09-15T11:00:00',
    id: 'late',
    label: 'Slot B',
    start: '2026-09-15T10:00:00',
  },
  {
    disabled: true,
    end: '2026-09-16T09:30:00',
    label: 'Slot C',
    start: '2026-09-16T09:00:00',
  },
  {
    end: '2026-09-16T11:00:00',
    label: 'Slot D',
    start: '2026-09-16T10:00:00',
  },
  {
    disabled: true,
    end: '2026-09-18T09:30:00',
    label: 'Slot E',
    start: '2026-09-18T09:00:00',
  },
];

function renderReady(overrides: Partial<ComponentProps<typeof BookingCalendar>> = {}) {
  return render(
    <BookingCalendar
      defaultSelectedDate={new Date(2026, 8, 15)}
      month={SEPTEMBER}
      slots={SLOTS}
      status="ready"
      {...overrides}
    />,
  );
}

describe('BookingCalendar', () => {
  it('lists open slots for the selected day', () => {
    renderReady();
    expect(screen.getByRole('grid', { name: 'September 2026' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Slot A' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Slot B' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Slot C' })).not.toBeInTheDocument();
  });

  it('reports the slot object when a start string or the slot itself is selected', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderReady({ onChange, value: '2026-09-15T09:00:00' });

    expect(screen.getByRole('radio', { name: 'Slot A' })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('radio', { name: 'Slot B' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ id: 'late', label: 'Slot B' }));
  });

  it('accepts a slot object as the controlled value', () => {
    renderReady({ value: SLOTS[1] });
    expect(screen.getByRole('radio', { name: 'Slot B' })).toHaveAttribute('aria-checked', 'true');
  });

  it('shows the next day slots and clears a selection from another day', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderReady({ onChange, value: SLOTS[0] });

    await user.click(screen.getByRole('button', { name: 'Wednesday, September 16, 2026' }));
    expect(onChange).toHaveBeenCalledWith(null);
    expect(screen.getByRole('radio', { name: 'Slot C' })).toHaveAttribute('data-disabled', '');
    expect(screen.getByRole('radio', { name: 'Slot D' })).toBeInTheDocument();
  });

  it('makes days without an enabled slot unavailable while ready', () => {
    renderReady();
    expect(screen.getByRole('button', { name: 'Thursday, September 17, 2026' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Friday, September 18, 2026' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Tuesday, September 15, 2026' })).not.toHaveAttribute(
      'aria-disabled',
    );
  });

  it('shows the empty-day status when empty days stay selectable', async () => {
    const user = userEvent.setup();
    renderReady({ disableDaysWithoutSlots: false });
    await user.click(screen.getByRole('button', { name: 'Thursday, September 17, 2026' }));
    expect(screen.getByRole('heading', { name: 'None' })).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  it.each([
    ['loading', 'status', 'Loading'],
    ['empty', 'heading', 'Empty'],
    ['error', 'alert', 'Error'],
    ['unconfigured', 'status', 'Unconfigured'],
  ] as const)('renders the %s status', (status, role, name) => {
    render(
      <BookingCalendar
        defaultSelectedDate={new Date(2026, 8, 15)}
        month={SEPTEMBER}
        slots={SLOTS}
        status={status}
      />,
    );
    expect(screen.getByRole(role, { name })).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(document.querySelector('[data-slot="booking-calendar"]')).toHaveAttribute(
      'data-status',
      status,
    );
  });

  it('marks the loading region busy', () => {
    render(<BookingCalendar month={SEPTEMBER} slots={[]} status="loading" />);
    expect(screen.getByRole('status', { name: 'Loading' })).toHaveAttribute('aria-busy', 'true');
  });

  it('uses caller-supplied status copy', () => {
    render(
      <BookingCalendar messages={{ emptyTitle: 'No times' }} month={SEPTEMBER} status="empty" />,
    );
    expect(screen.getByRole('heading', { name: 'No times' })).toBeInTheDocument();
  });
});
