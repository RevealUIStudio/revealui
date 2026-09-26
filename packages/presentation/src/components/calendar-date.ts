/**
 * Local calendar arithmetic for the month grid.
 * Day identity is year/month/day in the runtime local zone. No string parsing.
 */

export type WeekStartsOn = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type CalendarSize = 'sm' | 'default' | 'lg';

export const CALENDAR_DEFAULTS = {
  locale: 'en-US',
  weekStartsOn: 0 as WeekStartsOn,
  showOutsideDays: true,
};

export interface CalendarCell {
  date: Date;
  outside: boolean;
}

export interface WeekdayHeading {
  narrow: string;
  long: string;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addDays(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}

/** Adds calendar months, clamping the day to the last day of the target month. */
export function addMonths(date: Date, amount: number): Date {
  const target = new Date(date.getFullYear(), date.getMonth() + amount, 1);
  const year = target.getFullYear();
  const month = target.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const day = Math.min(date.getDate(), lastDay);
  return new Date(year, month, day);
}

export function compareDay(a: Date, b: Date): number {
  const aKey = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const bKey = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  if (aKey < bKey) return -1;
  if (aKey > bKey) return 1;
  return 0;
}

export function isSameDay(a: Date, b: Date): boolean {
  return compareDay(a, b) === 0;
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function isDayOutsideRange(date: Date, min?: Date, max?: Date): boolean {
  if (min && compareDay(date, min) < 0) return true;
  if (max && compareDay(date, max) > 0) return true;
  return false;
}

export function dateKey(date: Date): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const monthText = month < 10 ? `0${month}` : String(month);
  const dayText = day < 10 ? `0${day}` : String(day);
  return `${date.getFullYear()}-${monthText}-${dayText}`;
}

export function startOfWeek(date: Date, weekStartsOn: WeekStartsOn): Date {
  const diff = (date.getDay() - weekStartsOn + 7) % 7;
  return addDays(date, -diff);
}

export function endOfWeek(date: Date, weekStartsOn: WeekStartsOn): Date {
  return addDays(startOfWeek(date, weekStartsOn), 6);
}

export function buildMonthCells(month: Date, weekStartsOn: WeekStartsOn): CalendarCell[] {
  const first = startOfMonth(month);
  const leading = (first.getDay() - weekStartsOn + 7) % 7;
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells: CalendarCell[] = [];

  for (let index = 0; index < leading; index += 1) {
    cells.push({ date: addDays(first, index - leading), outside: true });
  }

  for (let day = 0; day < daysInMonth; day += 1) {
    cells.push({ date: addDays(first, day), outside: false });
  }

  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1];
    if (!last) break;
    cells.push({ date: addDays(last.date, 1), outside: true });
  }

  return cells;
}

export function chunkWeeks(cells: CalendarCell[]): CalendarCell[][] {
  const weeks: CalendarCell[][] = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }
  return weeks;
}

/** Sunday 4 Jan 2026 is the anchor for locale weekday labels. */
const WEEKDAY_ANCHOR = new Date(2026, 0, 4);

export function weekdayHeadings(locale: string, weekStartsOn: WeekStartsOn): WeekdayHeading[] {
  const narrow = new Intl.DateTimeFormat(locale, { weekday: 'narrow' });
  const long = new Intl.DateTimeFormat(locale, { weekday: 'long' });
  const headings: WeekdayHeading[] = [];

  for (let index = 0; index < 7; index += 1) {
    const date = addDays(WEEKDAY_ANCHOR, (index + weekStartsOn) % 7);
    headings.push({ narrow: narrow.format(date), long: long.format(date) });
  }

  return headings;
}

export function formatMonth(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date);
}

export function formatDay(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
    year: 'numeric',
  }).format(date);
}

export function toInstant(value: string | Date): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Whether the month `amount` steps away still contains a day inside `[min, max]`.
 * `amount` is -1 for the previous month and 1 for the next.
 */
export function isMonthReachable(month: Date, amount: -1 | 1, min?: Date, max?: Date): boolean {
  const target = startOfMonth(addMonths(startOfMonth(month), amount));
  if (amount < 0) {
    if (!min) return true;
    const last = new Date(target.getFullYear(), target.getMonth() + 1, 0);
    return compareDay(last, min) >= 0;
  }
  if (!max) return true;
  return compareDay(target, max) <= 0;
}
