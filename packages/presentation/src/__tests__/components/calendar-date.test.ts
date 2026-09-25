import { describe, expect, it } from 'vitest';
import {
  addMonths,
  buildMonthCells,
  isMonthReachable,
  weekdayHeadings,
} from '../../components/calendar-date.js';

describe('calendar dates', () => {
  it('clamps month addition to the last day of the target month', () => {
    const landed = addMonths(new Date(2026, 0, 31), 1);
    expect(landed.getFullYear()).toBe(2026);
    expect(landed.getMonth()).toBe(1);
    expect(landed.getDate()).toBe(28);
  });

  it('keeps 29 February when the target year is a leap year', () => {
    const landed = addMonths(new Date(2024, 0, 31), 1);
    expect(landed.getMonth()).toBe(1);
    expect(landed.getDate()).toBe(29);
  });

  it('builds a Sunday-start September 2026 grid with August leading days', () => {
    const cells = buildMonthCells(new Date(2026, 8, 1), 0);
    expect(cells[0]?.date.getMonth()).toBe(7);
    expect(cells[0]?.date.getDate()).toBe(30);
    expect(cells[0]?.outside).toBe(true);
    expect(cells).toHaveLength(35);
    const firstOfMonth = cells.find((cell) => !cell.outside);
    expect(firstOfMonth?.date.getDate()).toBe(1);
  });

  it('starts the week on Monday when asked', () => {
    const headings = weekdayHeadings('en-US', 1);
    expect(headings[0]?.long).toBe('Monday');
    expect(headings[6]?.long).toBe('Sunday');
  });

  it('blocks month navigation that would leave the inclusive range', () => {
    const september = new Date(2026, 8, 1);
    const min = new Date(2026, 8, 10);
    const max = new Date(2026, 8, 20);
    expect(isMonthReachable(september, -1, min, max)).toBe(false);
    expect(isMonthReachable(september, 1, min, max)).toBe(false);
  });
});
