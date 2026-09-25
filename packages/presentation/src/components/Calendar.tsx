'use client';

import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useControllableState } from '../hooks/use-controllable-state.js';
import { Box } from '../primitives/Box.js';
import { Flex } from '../primitives/Flex.js';
import { cn, cva, type VariantProps } from '../utils/cn.js';
import { Button } from './Button.js';
import {
  addDays,
  addMonths,
  buildMonthCells,
  CALENDAR_DEFAULTS,
  type CalendarSize,
  chunkWeeks,
  dateKey,
  endOfWeek,
  formatDay,
  formatMonth,
  isDayOutsideRange,
  isMonthReachable,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  type WeekStartsOn,
  weekdayHeadings,
} from './calendar-date.js';
import { Subheading } from './heading.js';

/**
 * `Calendar` — month grid primitive.
 *
 * Sovereign (no Radix/shadcn). Month navigation and day cells are `Button`s.
 * Selection, the visible month, and disabled days are controlled or uncontrolled.
 * Keyboard follows the ARIA grid date-picker pattern.
 */

const calendarVariants = cva(
  'flex w-full max-w-sm flex-col rounded-[var(--rvui-radius-lg)] border border-border bg-card text-foreground',
  {
    defaultVariants: { size: 'default' },
    variants: {
      size: {
        default: 'gap-3 p-3',
        lg: 'gap-4 p-4',
        sm: 'gap-2 p-2',
      },
    },
  },
);

const daySizeClass: Record<CalendarSize, string> = {
  default: 'size-9',
  lg: 'size-11',
  sm: 'size-8',
};

export type { CalendarSize, WeekStartsOn };

export interface CalendarProps extends VariantProps<typeof calendarVariants> {
  /** Selected day. `null` clears the selection. */
  value?: Date | null;
  defaultValue?: Date | null;
  onValueChange?: (date: Date) => void;
  /** Visible month. Any day in that month is accepted. */
  month?: Date;
  defaultMonth?: Date;
  onMonthChange?: (month: Date) => void;
  /** Inclusive lower bound. Earlier days are unavailable. */
  min?: Date;
  /** Inclusive upper bound. Later days are unavailable. */
  max?: Date;
  /** Extra unavailable days (holidays, closed weekdays, and so on). */
  isDateDisabled?: (date: Date) => boolean;
  weekStartsOn?: WeekStartsOn;
  locale?: string;
  className?: string;
  id?: string;
  'aria-label'?: string;
  previousMonthLabel?: string;
  nextMonthLabel?: string;
  /** Render leading and trailing days from adjacent months. Default true. */
  showOutsideDays?: boolean;
}

function Chevron({ direction }: { direction: 'previous' | 'next' }) {
  const path =
    direction === 'previous' ? 'M15.75 19.5 8.25 12l7.5-7.5' : 'm8.25 4.5 7.5 7.5-7.5 7.5';
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d={path} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Calendar({
  value: valueProp,
  defaultValue = null,
  onValueChange,
  month: monthProp,
  defaultMonth,
  onMonthChange,
  min,
  max,
  isDateDisabled,
  weekStartsOn = CALENDAR_DEFAULTS.weekStartsOn,
  locale = CALENDAR_DEFAULTS.locale,
  size = 'default',
  className,
  id,
  'aria-label': ariaLabel,
  previousMonthLabel = 'Previous month',
  nextMonthLabel = 'Next month',
  showOutsideDays = CALENDAR_DEFAULTS.showOutsideDays,
}: CalendarProps) {
  const captionId = useId();
  const dayRefs = useRef(new Map<string, HTMLButtonElement>());
  const focusIntent = useRef(false);
  const today = useMemo(() => new Date(), []);

  const [selected, setSelected] = useControllableState<Date | null>({
    defaultValue,
    onChange: (next) => {
      if (next) onValueChange?.(next);
    },
    value: valueProp,
  });

  const [visibleMonth, setVisibleMonth] = useControllableState<Date>({
    defaultValue: startOfMonth(defaultMonth ?? selected ?? new Date()),
    onChange: onMonthChange,
    value: monthProp,
  });

  const [focusedDate, setFocusedDate] = useState<Date>(() => {
    if (selected && isSameMonth(selected, visibleMonth)) return selected;
    return startOfMonth(visibleMonth);
  });

  const selectedKey = selected ? dateKey(selected) : '';
  const monthKey = dateKey(startOfMonth(visibleMonth));
  const selectedRef = useRef(selected);
  const visibleMonthRef = useRef(visibleMonth);
  selectedRef.current = selected;
  visibleMonthRef.current = visibleMonth;

  useEffect(() => {
    if (!(selectedKey && monthKey)) return;
    const currentSelected = selectedRef.current;
    const currentMonth = visibleMonthRef.current;
    if (!currentSelected) return;
    if (!isSameMonth(currentSelected, currentMonth)) return;
    setFocusedDate((current) => (isSameDay(current, currentSelected) ? current : currentSelected));
  }, [monthKey, selectedKey]);

  useEffect(() => {
    if (!focusIntent.current) return;
    focusIntent.current = false;
    dayRefs.current.get(dateKey(focusedDate))?.focus();
  }, [focusedDate]);

  const headings = useMemo(() => weekdayHeadings(locale, weekStartsOn), [locale, weekStartsOn]);
  const weeks = useMemo(
    () => chunkWeeks(buildMonthCells(visibleMonth, weekStartsOn)),
    [visibleMonth, weekStartsOn],
  );
  const monthLabel = formatMonth(visibleMonth, locale);
  const resolvedSize: CalendarSize = size ?? 'default';

  function unavailable(date: Date): boolean {
    if (isDayOutsideRange(date, min, max)) return true;
    return isDateDisabled?.(date) ?? false;
  }

  function moveFocus(next: Date): void {
    focusIntent.current = true;
    if (!isSameMonth(next, visibleMonth)) {
      setVisibleMonth(startOfMonth(next));
    }
    setFocusedDate(next);
  }

  function selectDay(date: Date): void {
    if (unavailable(date)) return;
    setFocusedDate(date);
    setSelected(date);
    if (!isSameMonth(date, visibleMonth)) {
      setVisibleMonth(startOfMonth(date));
    }
  }

  function shiftMonth(amount: -1 | 1): void {
    if (!isMonthReachable(visibleMonth, amount, min, max)) return;
    const next = startOfMonth(addMonths(visibleMonth, amount));
    setVisibleMonth(next);
    setFocusedDate((current) => {
      const landed = addMonths(current, amount);
      return isSameMonth(landed, next) ? landed : next;
    });
  }

  function onGridKeyDown(event: KeyboardEvent<HTMLTableElement>): void {
    let next: Date | null = null;
    switch (event.key) {
      case 'ArrowRight':
        next = addDays(focusedDate, 1);
        break;
      case 'ArrowLeft':
        next = addDays(focusedDate, -1);
        break;
      case 'ArrowDown':
        next = addDays(focusedDate, 7);
        break;
      case 'ArrowUp':
        next = addDays(focusedDate, -7);
        break;
      case 'Home':
        next = startOfWeek(focusedDate, weekStartsOn);
        break;
      case 'End':
        next = endOfWeek(focusedDate, weekStartsOn);
        break;
      case 'PageUp':
        next = addMonths(focusedDate, event.shiftKey ? -12 : -1);
        break;
      case 'PageDown':
        next = addMonths(focusedDate, event.shiftKey ? 12 : 1);
        break;
      default:
        return;
    }
    event.preventDefault();
    moveFocus(next);
  }

  const tabDate = !(showOutsideDays || isSameMonth(focusedDate, visibleMonth))
    ? startOfMonth(visibleMonth)
    : focusedDate;

  return (
    <Box
      aria-label={ariaLabel}
      className={cn(calendarVariants({ size: resolvedSize }), className)}
      data-size={resolvedSize}
      data-slot="calendar"
      id={id}
    >
      <Flex align="center" className="w-full gap-2" justify="between">
        <Button
          appearance="ghost"
          aria-label={previousMonthLabel}
          disabled={!isMonthReachable(visibleMonth, -1, min, max)}
          onClick={() => shiftMonth(-1)}
          size="icon"
          type="button"
          variant="neutral"
        >
          <Chevron direction="previous" />
        </Button>
        <Subheading className="min-w-0 flex-1 text-center" id={captionId} level={2}>
          {monthLabel}
        </Subheading>
        <Button
          appearance="ghost"
          aria-label={nextMonthLabel}
          disabled={!isMonthReachable(visibleMonth, 1, min, max)}
          onClick={() => shiftMonth(1)}
          size="icon"
          type="button"
          variant="neutral"
        >
          <Chevron direction="next" />
        </Button>
      </Flex>
      <table
        aria-labelledby={captionId}
        className="w-full border-collapse"
        onKeyDown={onGridKeyDown}
        // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: APG date picker exposes the month table as a grid
        role="grid"
      >
        <thead>
          <tr>
            {headings.map((heading) => (
              <th
                aria-label={heading.long}
                className="pb-1 text-center text-xs font-medium text-muted-foreground"
                key={heading.long}
                scope="col"
              >
                <span aria-hidden="true">{heading.narrow}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={dateKey(week[0]?.date ?? visibleMonth)}>
              {week.map((cell) => {
                const key = dateKey(cell.date);
                const isSelected = selected != null && isSameDay(cell.date, selected);
                const isToday = isSameDay(cell.date, today);
                const isUnavailable = unavailable(cell.date);
                const showDay = showOutsideDays || !cell.outside;
                const isTabStop = isSameDay(cell.date, tabDate);

                return (
                  <td className="p-0.5 text-center" key={key}>
                    {showDay ? (
                      <Button
                        appearance={isSelected ? 'solid' : 'ghost'}
                        aria-current={isToday ? 'date' : undefined}
                        aria-disabled={isUnavailable || undefined}
                        aria-label={formatDay(cell.date, locale)}
                        aria-selected={isSelected}
                        className={cn(
                          daySizeClass[resolvedSize],
                          'px-0',
                          !isSelected && cell.outside && 'text-muted-foreground',
                          !isSelected && isToday && 'ring-1 ring-border',
                          isUnavailable && 'opacity-40',
                        )}
                        data-outside={cell.outside ? '' : undefined}
                        data-selected={isSelected ? '' : undefined}
                        data-today={isToday ? '' : undefined}
                        onClick={() => selectDay(cell.date)}
                        ref={(node) => {
                          if (node) dayRefs.current.set(key, node);
                          else dayRefs.current.delete(key);
                        }}
                        size="icon"
                        tabIndex={isTabStop ? 0 : -1}
                        type="button"
                        variant={isSelected ? 'brand' : 'neutral'}
                      >
                        {cell.date.getDate()}
                      </Button>
                    ) : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </Box>
  );
}

export { Calendar, calendarVariants };
