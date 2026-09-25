import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Calendar } from '../../components/Calendar.js';

const SEPTEMBER = new Date(2026, 8, 1);

function dayButton(name: string): HTMLElement {
  return screen.getByRole('button', { name });
}

describe('Calendar', () => {
  it('renders a month grid with navigation and the visible month', () => {
    render(<Calendar defaultMonth={SEPTEMBER} />);
    expect(screen.getByRole('grid', { name: 'September 2026' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'September 2026' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous month' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next month' })).toBeInTheDocument();
    expect(dayButton('Tuesday, September 1, 2026')).toBeInTheDocument();
  });

  it.each(['sm', 'default', 'lg'] as const)('renders size %s without throwing', (size) => {
    render(<Calendar defaultMonth={SEPTEMBER} size={size} />);
    expect(screen.getByRole('grid')).toBeInTheDocument();
    expect(document.querySelector('[data-slot="calendar"]')).toHaveAttribute('data-size', size);
  });

  it('moves between months from the navigation buttons', async () => {
    const user = userEvent.setup();
    const onMonthChange = vi.fn();
    render(<Calendar defaultMonth={SEPTEMBER} onMonthChange={onMonthChange} />);

    await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByRole('heading', { name: 'October 2026' })).toBeInTheDocument();
    expect(onMonthChange).toHaveBeenCalled();
    const next = onMonthChange.mock.calls[0]?.[0] as Date;
    expect(next.getMonth()).toBe(9);
    expect(next.getDate()).toBe(1);

    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByRole('heading', { name: 'September 2026' })).toBeInTheDocument();
  });

  it('selects a day and reports it', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Calendar defaultMonth={SEPTEMBER} onValueChange={onValueChange} />);

    await user.click(dayButton('Tuesday, September 15, 2026'));
    expect(onValueChange).toHaveBeenCalledOnce();
    const selected = onValueChange.mock.calls[0]?.[0] as Date;
    expect(selected.getFullYear()).toBe(2026);
    expect(selected.getMonth()).toBe(8);
    expect(selected.getDate()).toBe(15);
    const selectedDay = dayButton('Tuesday, September 15, 2026');
    expect(selectedDay).not.toHaveAttribute('aria-selected');
    expect(selectedDay.closest('td')).toHaveAttribute('role', 'gridcell');
    expect(selectedDay.closest('td')).toHaveAttribute('aria-selected', 'true');
    const otherDay = dayButton('Wednesday, September 16, 2026');
    expect(otherDay).not.toHaveAttribute('aria-selected');
    expect(otherDay.closest('td')).toHaveAttribute('aria-selected', 'false');
  });

  it('marks leading days as outside the visible month', () => {
    render(<Calendar defaultMonth={SEPTEMBER} />);
    expect(dayButton('Sunday, August 30, 2026')).toHaveAttribute('data-outside', '');
  });

  it('does not select a day outside min and max', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Calendar
        defaultMonth={SEPTEMBER}
        max={new Date(2026, 8, 20)}
        min={new Date(2026, 8, 10)}
        onValueChange={onValueChange}
      />,
    );

    const early = dayButton('Tuesday, September 1, 2026');
    expect(early).toHaveAttribute('aria-disabled', 'true');
    await user.click(early);
    expect(onValueChange).not.toHaveBeenCalled();

    expect(screen.getByRole('button', { name: 'Previous month' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled();
  });

  it('does not select a day rejected by isDateDisabled', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Calendar
        defaultMonth={SEPTEMBER}
        isDateDisabled={(date) => date.getDate() === 16}
        onValueChange={onValueChange}
      />,
    );

    const closed = dayButton('Wednesday, September 16, 2026');
    expect(closed).toHaveAttribute('aria-disabled', 'true');
    await user.click(closed);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('moves focus with arrow keys and selects with Enter', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Calendar
        defaultMonth={SEPTEMBER}
        onValueChange={onValueChange}
        value={new Date(2026, 8, 15)}
      />,
    );

    dayButton('Tuesday, September 15, 2026').focus();
    await user.keyboard('{ArrowRight}');
    expect(dayButton('Wednesday, September 16, 2026')).toHaveFocus();
    await user.keyboard('{Enter}');
    const selected = onValueChange.mock.calls[0]?.[0] as Date;
    expect(selected.getDate()).toBe(16);
  });

  it('jumps to the week edges and the next month from the keyboard', async () => {
    const user = userEvent.setup();
    render(<Calendar defaultMonth={SEPTEMBER} value={new Date(2026, 8, 15)} />);

    dayButton('Tuesday, September 15, 2026').focus();
    await user.keyboard('{PageDown}');
    expect(screen.getByRole('heading', { name: 'October 2026' })).toBeInTheDocument();
    expect(dayButton('Thursday, October 15, 2026')).toHaveFocus();
    await user.keyboard('{Home}');
    expect(dayButton('Sunday, October 11, 2026')).toHaveFocus();
    await user.keyboard('{End}');
    expect(dayButton('Saturday, October 17, 2026')).toHaveFocus();
  });

  it('selects an adjacent-month day and shows that month', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Calendar defaultMonth={SEPTEMBER} onValueChange={onValueChange} />);

    await user.click(dayButton('Monday, August 31, 2026'));
    const selected = onValueChange.mock.calls[0]?.[0] as Date;
    expect(selected.getMonth()).toBe(7);
    expect(selected.getDate()).toBe(31);
    expect(screen.getByRole('heading', { name: 'August 2026' })).toBeInTheDocument();
  });

  it('labels weekday columns from the configured week start', () => {
    render(<Calendar defaultMonth={SEPTEMBER} weekStartsOn={1} />);
    const headers = screen.getAllByRole('columnheader');
    expect(headers[0]).toHaveAttribute('aria-label', 'Monday');
    expect(headers[6]).toHaveAttribute('aria-label', 'Sunday');
  });
});
