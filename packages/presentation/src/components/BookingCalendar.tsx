'use client';

import { useMemo } from 'react';
import { useControllableState } from '../hooks/use-controllable-state.js';
import { Box } from '../primitives/Box.js';
import { cn } from '../utils/cn.js';
import { Calendar, type CalendarProps, type CalendarSize } from './Calendar.js';
import { isSameDay, startOfMonth, toInstant, type WeekStartsOn } from './calendar-date.js';
import { Callout } from './callout.js';
import { EmptyState } from './empty-state.js';
import { Label as FieldLabel } from './fieldset.js';
import { Radio, RadioField, RadioGroup } from './radio.js';
import { Skeleton } from './skeleton.js';
import { Text } from './text.js';

/**
 * `BookingCalendar` — day grid plus the open slots for the selected day.
 *
 * Controlled selection accepts a start instant (string or the slot's `start`)
 * or the slot object. `onChange` always receives the slot, or `null` when the
 * selection is cleared. Slot `label` is consumer-supplied. Status copy is
 * overridable via `messages` and defaults to the status word itself.
 */

export type BookingCalendarStatus = 'loading' | 'ready' | 'empty' | 'error' | 'unconfigured';

export interface BookingSlot {
  /** Start instant. ISO-8601 string or `Date`. */
  start: string | Date;
  /** End instant. ISO-8601 string or `Date`. Displayed only through `label`. */
  end: string | Date;
  /** Consumer-supplied label. The component does not invent slot copy. */
  label: string;
  /** Stable identity. Falls back to the start instant. */
  id?: string;
  disabled?: boolean;
}

/** Selected start instant, the slot itself, or nothing. */
export type BookingCalendarValue = string | BookingSlot | null;

export interface BookingCalendarMessages {
  previousMonth: string;
  nextMonth: string;
  loading: string;
  emptyTitle: string;
  emptyDescription: string;
  errorTitle: string;
  errorDescription: string;
  unconfiguredTitle: string;
  unconfiguredDescription: string;
  slotsLabel: string;
  noSlotsTitle: string;
  noSlotsDescription: string;
}

export const BOOKING_CALENDAR_DEFAULT_MESSAGES: BookingCalendarMessages = {
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
  loading: 'Loading',
  emptyTitle: 'Empty',
  emptyDescription: '',
  errorTitle: 'Error',
  errorDescription: '',
  unconfiguredTitle: 'Unconfigured',
  unconfiguredDescription: '',
  slotsLabel: 'Slots',
  noSlotsTitle: 'None',
  noSlotsDescription: '',
};

export interface BookingCalendarProps {
  slots?: BookingSlot[];
  /** Selected start instant or slot. */
  value?: BookingCalendarValue;
  defaultValue?: BookingCalendarValue;
  /** Receives the matching slot, or `null` when the selection is cleared. */
  onChange?: (slot: BookingSlot | null) => void;
  status: BookingCalendarStatus;
  selectedDate?: Date | null;
  defaultSelectedDate?: Date | null;
  onSelectedDateChange?: (date: Date) => void;
  month?: Date;
  defaultMonth?: Date;
  onMonthChange?: (month: Date) => void;
  min?: Date;
  max?: Date;
  isDateDisabled?: (date: Date) => boolean;
  /**
   * When `status` is `ready`, days with no enabled slot are unavailable.
   * Default true.
   */
  disableDaysWithoutSlots?: boolean;
  weekStartsOn?: WeekStartsOn;
  locale?: string;
  size?: CalendarSize;
  className?: string;
  id?: string;
  'aria-label'?: string;
  /** Radio group name, forwarded so a checked slot can submit with a form. */
  name?: string;
  messages?: Partial<BookingCalendarMessages>;
  showOutsideDays?: boolean;
}

function slotIdentity(slot: BookingSlot): string {
  if (slot.id) return slot.id;
  if (typeof slot.start === 'string') return slot.start;
  const start = toInstant(slot.start);
  return start ? start.toISOString() : slot.label;
}

function matchesBookingValue(slot: BookingSlot, value: BookingCalendarValue): boolean {
  if (value == null) return false;
  if (typeof value === 'string') {
    if (slot.id === value) return true;
    if (typeof slot.start === 'string' && slot.start === value) return true;
    const start = toInstant(slot.start);
    const wanted = toInstant(value);
    return start != null && wanted != null && start.getTime() === wanted.getTime();
  }
  if (slot.id && value.id && slot.id === value.id) return true;
  const start = toInstant(slot.start);
  const wanted = toInstant(value.start);
  return start != null && wanted != null && start.getTime() === wanted.getTime();
}

function resolveSelectedSlot(
  slots: readonly BookingSlot[],
  value: BookingCalendarValue | undefined,
): BookingSlot | null {
  if (value == null) return null;
  const match = slots.find((slot) => matchesBookingValue(slot, value));
  if (match) return match;
  if (typeof value === 'string') return null;
  return value;
}

function slotsOnDay(slots: readonly BookingSlot[], day: Date): BookingSlot[] {
  return slots
    .filter((slot) => {
      const start = toInstant(slot.start);
      return start != null && isSameDay(start, day);
    })
    .slice()
    .sort((a, b) => {
      const aTime = toInstant(a.start)?.getTime() ?? 0;
      const bTime = toInstant(b.start)?.getTime() ?? 0;
      return aTime - bTime;
    });
}

function dayFromValue(value: BookingCalendarValue | undefined): Date | null {
  if (value == null) return null;
  if (typeof value === 'string') return toInstant(value);
  return toInstant(value.start);
}

function earliestSlotDay(slots: readonly BookingSlot[]): Date | null {
  let earliest: Date | null = null;
  for (const slot of slots) {
    const start = toInstant(slot.start);
    if (!start) continue;
    if (!earliest || start.getTime() < earliest.getTime()) earliest = start;
  }
  return earliest;
}

function BookingCalendar({
  slots = [],
  value,
  defaultValue = null,
  onChange,
  status,
  selectedDate: selectedDateProp,
  defaultSelectedDate,
  onSelectedDateChange,
  month,
  defaultMonth,
  onMonthChange,
  min,
  max,
  isDateDisabled,
  disableDaysWithoutSlots = true,
  weekStartsOn,
  locale,
  size,
  className,
  id,
  'aria-label': ariaLabel,
  name,
  messages: messageOverrides,
  showOutsideDays,
}: BookingCalendarProps) {
  const messages: BookingCalendarMessages = {
    ...BOOKING_CALENDAR_DEFAULT_MESSAGES,
    ...messageOverrides,
  };

  const selectionSeed = value !== undefined ? value : defaultValue;
  const initialDay =
    defaultSelectedDate ?? dayFromValue(selectionSeed) ?? earliestSlotDay(slots) ?? new Date();

  const [selectedDate, setSelectedDate] = useControllableState<Date | null>({
    defaultValue: initialDay,
    onChange: (next) => {
      if (next) onSelectedDateChange?.(next);
    },
    value: selectedDateProp,
  });

  const [selection, setSelection] = useControllableState<BookingCalendarValue>({
    defaultValue,
    onChange: (next) => {
      if (next == null) {
        onChange?.(null);
        return;
      }
      if (typeof next === 'string') {
        onChange?.(resolveSelectedSlot(slots, next));
        return;
      }
      onChange?.(next);
    },
    value,
  });

  const activeDay = selectedDate ?? initialDay;
  const daySlots = useMemo(() => slotsOnDay(slots, activeDay), [slots, activeDay]);

  function unavailable(date: Date): boolean {
    if (isDateDisabled?.(date)) return true;
    if (status === 'ready' && disableDaysWithoutSlots) {
      const onDay = slotsOnDay(slots, date);
      return onDay.length === 0 || onDay.every((slot) => slot.disabled === true);
    }
    return false;
  }

  function handleDaySelect(date: Date): void {
    setSelectedDate(date);
    const current = resolveSelectedSlot(slots, selection);
    if (!current) return;
    const start = toInstant(current.start);
    if (!(start && isSameDay(start, date))) {
      setSelection(null);
    }
  }

  function handleSlotChange(key: string): void {
    const slot = daySlots.find((item) => slotIdentity(item) === key);
    if (!slot || slot.disabled) return;
    setSelection(slot);
  }

  const selectedSlot = daySlots.find((slot) => matchesBookingValue(slot, selection));
  const calendarMonth = month ?? defaultMonth ?? startOfMonth(activeDay);

  const calendarProps: Pick<
    CalendarProps,
    | 'weekStartsOn'
    | 'locale'
    | 'size'
    | 'min'
    | 'max'
    | 'showOutsideDays'
    | 'previousMonthLabel'
    | 'nextMonthLabel'
  > = {
    locale,
    max,
    min,
    nextMonthLabel: messages.nextMonth,
    previousMonthLabel: messages.previousMonth,
    showOutsideDays,
    size,
    weekStartsOn,
  };

  return (
    <Box
      aria-label={ariaLabel}
      className={cn('flex w-full max-w-sm flex-col gap-4', className)}
      data-slot="booking-calendar"
      data-status={status}
      id={id}
    >
      <Calendar
        {...calendarProps}
        defaultMonth={calendarMonth}
        isDateDisabled={unavailable}
        month={month}
        onMonthChange={onMonthChange}
        onValueChange={handleDaySelect}
        value={selectedDate}
      />
      <Box aria-live="polite" className="flex flex-col gap-2">
        <SlotStatus
          daySlots={daySlots}
          messages={messages}
          name={name}
          onSlotChange={handleSlotChange}
          selectedKey={selectedSlot ? slotIdentity(selectedSlot) : ''}
          status={status}
        />
      </Box>
    </Box>
  );
}

function SlotStatus({
  status,
  messages,
  daySlots,
  selectedKey,
  onSlotChange,
  name,
}: {
  status: BookingCalendarStatus;
  messages: BookingCalendarMessages;
  daySlots: BookingSlot[];
  selectedKey: string;
  onSlotChange: (key: string) => void;
  name?: string;
}) {
  if (status === 'loading') {
    return (
      <Box
        aria-busy="true"
        aria-label={messages.loading}
        className="flex flex-col gap-2"
        role="status"
      >
        <Text>{messages.loading}</Text>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </Box>
    );
  }

  if (status === 'error') {
    return (
      <Box aria-label={messages.errorTitle} role="alert">
        <Callout role="note" title={messages.errorTitle} variant="error">
          {messages.errorDescription || null}
        </Callout>
      </Box>
    );
  }

  if (status === 'unconfigured') {
    return (
      <Box aria-label={messages.unconfiguredTitle} role="status">
        <Callout role="note" title={messages.unconfiguredTitle} variant="warning">
          {messages.unconfiguredDescription || null}
        </Callout>
      </Box>
    );
  }

  if (status === 'empty') {
    return (
      <EmptyState
        className="px-4 py-8"
        description={messages.emptyDescription || undefined}
        title={messages.emptyTitle}
      />
    );
  }

  if (daySlots.length === 0) {
    return (
      <EmptyState
        className="px-4 py-8"
        description={messages.noSlotsDescription || undefined}
        title={messages.noSlotsTitle}
      />
    );
  }

  return (
    <RadioGroup
      aria-label={messages.slotsLabel}
      name={name}
      onChange={onSlotChange}
      value={selectedKey}
    >
      {daySlots.map((slot) => {
        const key = slotIdentity(slot);
        return (
          <RadioField disabled={slot.disabled} key={key}>
            <Radio aria-label={slot.label} disabled={slot.disabled} value={key} />
            <FieldLabel>{slot.label}</FieldLabel>
          </RadioField>
        );
      })}
    </RadioGroup>
  );
}

export { BookingCalendar };
