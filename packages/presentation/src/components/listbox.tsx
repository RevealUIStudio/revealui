'use client';

import type React from 'react';
import {
  Children,
  createContext,
  isValidElement,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useClickOutside } from '../hooks/use-click-outside.js';
import { useControllableState } from '../hooks/use-controllable-state.js';
import { useEscapeKey } from '../hooks/use-escape-key.js';
import { usePopover } from '../hooks/use-popover.js';
import { useTransition } from '../hooks/use-transition.js';
import { cn } from '../utils/cn.js';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface ListboxContextValue<T = unknown> {
  value: T;
  setValue: (v: T) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  disabled: boolean;
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  registerOption: (index: number, value: T, el: HTMLElement | null) => void;
  optionCount: number;
  buttonId: string;
  listId: string;
}

const ListboxContext = createContext<ListboxContextValue | null>(null);

function useListboxContext(): ListboxContextValue {
  const ctx = use(ListboxContext);
  if (!ctx) {
    throw new Error('Listbox compound components must be used within <Listbox>');
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countOptions(children: ReactNode): number {
  let count = 0;
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if ((child.type as unknown) === ListboxOption) {
      count++;
    }
  });
  return count;
}

// ---------------------------------------------------------------------------
// OptionIndexProvider
// ---------------------------------------------------------------------------

const OptionIndexContext = createContext<number>(-1);

function OptionIndexProvider({ children }: { children: ReactNode }) {
  let index = 0;
  return (
    <>
      {Children.map(children, (child) => {
        if (!isValidElement(child)) return child;
        if ((child.type as unknown) === ListboxOption) {
          const currentIndex = index++;
          return (
            <OptionIndexContext.Provider value={currentIndex}>{child}</OptionIndexContext.Provider>
          );
        }
        return child;
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Listbox (root)
// ---------------------------------------------------------------------------

export function Listbox<T>({
  className,
  placeholder,
  autoFocus = false,
  'aria-label': ariaLabel,
  children: options,
  value: controlledValue,
  defaultValue,
  onChange,
  disabled = false,
  name,
}: {
  className?: string;
  placeholder?: React.ReactNode;
  autoFocus?: boolean;
  'aria-label'?: string;
  children?: ReactNode;
  value?: T;
  defaultValue?: T;
  onChange?: (value: T) => void;
  disabled?: boolean;
  name?: string;
}) {
  const [value, setValue] = useControllableState<T>({
    value: controlledValue,
    defaultValue: defaultValue as T,
    onChange,
  });

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [optionCount, setOptionCount] = useState(0);

  const buttonId = useId();
  const listId = useId();

  const optionMapRef = useRef<Map<number, { value: T; element: HTMLElement | null }>>(new Map());

  const registerOption = useCallback((index: number, optValue: T, element: HTMLElement | null) => {
    optionMapRef.current.set(index, { value: optValue, element });
  }, []);

  const { triggerRef, popoverRef, popoverProps } = usePopover({
    open,
    anchor: 'selection start',
    gap: 0,
    padding: 16,
  });

  const { mounted, nodeRef, transitionProps } = useTransition(open);

  const focusTrigger = useCallback(() => {
    triggerRef.current?.focus();
  }, [triggerRef]);

  useEffect(() => {
    setOptionCount(countOptions(options));
  }, [options]);

  useEffect(() => {
    if (autoFocus && !disabled) {
      focusTrigger();
    }
  }, [autoFocus, disabled, focusTrigger]);

  useClickOutside([triggerRef, popoverRef], () => setOpen(false), open);

  useEscapeKey(() => {
    setOpen(false);
    focusTrigger();
  }, open);

  const selectActiveOption = useCallback(() => {
    const entry = optionMapRef.current.get(activeIndex);
    if (entry) {
      setValue(entry.value);
      setOpen(false);
      focusTrigger();
    }
  }, [activeIndex, focusTrigger, setValue]);

  const handleOptionsKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          setActiveIndex((prev) => {
            const next = prev + 1;
            return next >= optionCount ? 0 : next;
          });
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          setActiveIndex((prev) => {
            const next = prev - 1;
            return next < 0 ? optionCount - 1 : next;
          });
          break;
        }
        case 'Home': {
          e.preventDefault();
          setActiveIndex(0);
          break;
        }
        case 'End': {
          e.preventDefault();
          setActiveIndex(optionCount - 1);
          break;
        }
        case 'Enter':
        case ' ': {
          e.preventDefault();
          selectActiveOption();
          break;
        }
      }
    },
    [optionCount, selectActiveOption],
  );

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const entry = optionMapRef.current.get(activeIndex);
    entry?.element?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  useEffect(() => {
    if (open) {
      let selectedIdx = -1;
      for (const [idx, entry] of optionMapRef.current.entries()) {
        if (entry.value === value) {
          selectedIdx = idx;
          break;
        }
      }
      setActiveIndex(selectedIdx >= 0 ? selectedIdx : 0);
    }
  }, [open, value]);

  useEffect(() => {
    if (mounted && popoverRef.current) {
      popoverRef.current.focus({ preventScroll: true });
    }
  }, [mounted, popoverRef]);

  const selectedContent = useMemo(() => {
    let matched: ReactNode = null;
    Children.forEach(options, (child) => {
      if (!isValidElement(child)) return;
      if (
        (child.type as unknown) === ListboxOption &&
        (child.props as { value?: unknown }).value === value
      ) {
        matched = (child.props as { children?: ReactNode }).children;
      }
    });
    return matched;
  }, [options, value]);

  const ctx = useMemo<ListboxContextValue<T>>(
    () => ({
      value: value,
      setValue: setValue as (v: unknown) => void,
      open,
      setOpen,
      disabled,
      activeIndex,
      setActiveIndex,
      registerOption: registerOption as (
        index: number,
        value: unknown,
        el: HTMLElement | null,
      ) => void,
      optionCount,
      buttonId,
      listId,
    }),
    [value, setValue, open, disabled, activeIndex, registerOption, optionCount, buttonId, listId],
  );

  const handleButtonClick = useCallback(() => {
    if (!disabled) {
      setOpen((prev) => !prev);
    }
  }, [disabled]);

  const handleButtonKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(true);
      }
    },
    [disabled],
  );

  const selectedSharedClasses = cn(
    'flex min-w-0 items-center',
    '*:data-[slot=icon]:size-5 *:data-[slot=icon]:shrink-0 sm:*:data-[slot=icon]:size-4',
    '*:data-[slot=icon]:text-muted-foreground group-data-focus/option:*:data-[slot=icon]:text-primary-foreground',
    'forced-colors:*:data-[slot=icon]:text-[CanvasText] forced-colors:group-data-focus/option:*:data-[slot=icon]:text-[Canvas]',
    '*:data-[slot=avatar]:-mx-0.5 *:data-[slot=avatar]:size-6 sm:*:data-[slot=avatar]:size-5',
  );

  const displayContent =
    selectedContent != null ? (
      <span className={selectedSharedClasses}>{selectedContent}</span>
    ) : placeholder ? (
      <span className="block truncate text-muted-foreground">{placeholder}</span>
    ) : null;

  return (
    <ListboxContext.Provider value={ctx as ListboxContextValue}>
      {name && <input type="hidden" name={name} value={String(value ?? '')} />}

      <button
        ref={triggerRef as React.RefObject<HTMLButtonElement>}
        id={buttonId}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        aria-disabled={disabled || undefined}
        data-slot="control"
        data-disabled={disabled ? '' : undefined}
        data-active={open ? '' : undefined}
        disabled={disabled}
        onClick={handleButtonClick}
        onKeyDown={handleButtonKeyDown}
        className={cn([
          className,
          'group relative block w-full',
          'before:absolute before:inset-px before:rounded-[calc(var(--radius-lg)-1px)] before:bg-card before:shadow-sm',

          'focus:outline-hidden',
          'after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:ring-transparent after:ring-inset data-focus:after:ring-2 data-focus:after:ring-ring',
          'data-disabled:opacity-50 data-disabled:before:bg-border data-disabled:before:shadow-none',
        ])}
      >
        <span
          className={cn([
            'relative block w-full appearance-none rounded-lg py-[calc(--spacing(2.5)-1px)] sm:py-[calc(--spacing(1.5)-1px)]',
            'min-h-11 sm:min-h-9',
            'pr-[calc(--spacing(7)-1px)] pl-[calc(--spacing(3.5)-1px)] sm:pl-[calc(--spacing(3)-1px)]',
            'text-left text-base/6 text-foreground placeholder:text-muted-foreground sm:text-sm/6 forced-colors:text-[CanvasText]',
            'border border-border group-data-active:border-border-strong group-data-hover:border-border-strong',
            'bg-transparent',
            'group-data-invalid:border-destructive group-data-hover:group-data-invalid:border-destructive',
            'group-data-disabled:border-border group-data-disabled:opacity-100',
          ])}
        >
          {displayContent}
        </span>
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
          <svg
            className="size-5 stroke-muted-foreground group-data-disabled:stroke-muted-foreground sm:size-4 forced-colors:stroke-[CanvasText]"
            viewBox="0 0 16 16"
            aria-hidden="true"
            fill="none"
          >
            <path
              d="M5.75 10.75L8 13L10.25 10.75"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M10.25 5.25L8 3L5.75 5.25"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      {mounted &&
        createPortal(
          <div
            ref={(node) => {
              (popoverRef as React.MutableRefObject<HTMLElement | null>).current = node;
              (nodeRef as React.MutableRefObject<HTMLElement | null>).current = node;
            }}
            {...popoverProps}
            {...transitionProps}
            id={listId}
            role="listbox"
            aria-labelledby={buttonId}
            tabIndex={-1}
            onKeyDown={handleOptionsKeyDown}
            className={cn(
              '[--anchor-offset:-1.625rem] [--anchor-padding:--spacing(4)] sm:[--anchor-offset:-1.375rem]',
              'isolate w-max min-w-[calc(var(--button-width)+1.75rem)] scroll-py-1 rounded-xl p-1 select-none',
              'outline outline-transparent focus:outline-hidden',
              'overflow-y-scroll overscroll-contain',
              'bg-card/75 backdrop-blur-xl',
              'shadow-lg ring-1 ring-border-strong',
              'transition-opacity duration-100 ease-in data-closed:data-leave:opacity-0 data-transition:pointer-events-none',
            )}
            style={{
              ...popoverProps.style,
              minWidth: triggerRef.current
                ? `${triggerRef.current.getBoundingClientRect().width + 28}px`
                : undefined,
            }}
          >
            <OptionIndexProvider>{options}</OptionIndexProvider>
          </div>,
          document.body,
        )}
    </ListboxContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// ListboxOption
// ---------------------------------------------------------------------------

export function ListboxOption<T>({
  children,
  className,
  value: optionValue,
  disabled: optionDisabled = false,
}: {
  className?: string;
  children?: ReactNode;
  value: T;
  disabled?: boolean;
}) {
  const ctx = useListboxContext();
  const index = use(OptionIndexContext);
  const optionRef = useRef<HTMLDivElement>(null);

  const isSelected = ctx.value === optionValue;
  const isFocused = ctx.activeIndex === index;

  useEffect(() => {
    ctx.registerOption(index, optionValue, optionRef.current);
  }, [index, optionValue, ctx.registerOption, ctx]);

  const sharedClasses = cn(
    'flex min-w-0 items-center',
    '*:data-[slot=icon]:size-5 *:data-[slot=icon]:shrink-0 sm:*:data-[slot=icon]:size-4',
    '*:data-[slot=icon]:text-muted-foreground group-data-focus/option:*:data-[slot=icon]:text-primary-foreground',
    'forced-colors:*:data-[slot=icon]:text-[CanvasText] forced-colors:group-data-focus/option:*:data-[slot=icon]:text-[Canvas]',
    '*:data-[slot=avatar]:-mx-0.5 *:data-[slot=avatar]:size-6 sm:*:data-[slot=avatar]:size-5',
  );

  const handleClick = useCallback(() => {
    if (optionDisabled) return;
    ctx.setValue(optionValue);
    ctx.setOpen(false);
  }, [optionDisabled, ctx.setValue, ctx.setOpen, optionValue, ctx]);

  const handlePointerEnter = useCallback(() => {
    if (!optionDisabled) {
      ctx.setActiveIndex(index);
    }
  }, [optionDisabled, ctx.setActiveIndex, index, ctx]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction is handled by the parent listbox trigger and roving focus
    <div
      ref={optionRef}
      role="option"
      aria-selected={isSelected}
      aria-disabled={optionDisabled || undefined}
      data-selected={isSelected ? '' : undefined}
      data-focus={isFocused ? '' : undefined}
      data-disabled={optionDisabled ? '' : undefined}
      onClick={handleClick}
      onPointerEnter={handlePointerEnter}
      tabIndex={-1}
      className={cn(
        'group/option grid cursor-default grid-cols-[--spacing(5)_1fr] items-baseline gap-x-2 rounded-lg py-2.5 pr-3.5 pl-2 sm:grid-cols-[--spacing(4)_1fr] sm:py-1.5 sm:pr-3 sm:pl-1.5',
        'text-base/6 text-foreground sm:text-sm/6 forced-colors:text-[CanvasText]',
        'outline-hidden data-focus:bg-primary data-focus:text-primary-foreground',
        'forced-color-adjust-none forced-colors:data-focus:bg-[Highlight] forced-colors:data-focus:text-[HighlightText]',
        'data-disabled:opacity-50',
      )}
    >
      <svg
        className="relative hidden size-5 self-center stroke-current group-data-selected/option:inline sm:size-4"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <path d="M4 8.5l3 3L12 4" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className={cn(className, sharedClasses, 'col-start-2')}>{children}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ListboxLabel
// ---------------------------------------------------------------------------

export function ListboxLabel({ className, ...props }: React.ComponentPropsWithoutRef<'span'>) {
  return (
    <span
      {...props}
      className={cn(className, 'ml-2.5 truncate first:ml-0 sm:ml-2 sm:first:ml-0')}
    />
  );
}

// ---------------------------------------------------------------------------
// ListboxDescription
// ---------------------------------------------------------------------------

export function ListboxDescription({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<'span'>) {
  return (
    <span
      {...props}
      className={cn(
        className,
        'flex flex-1 overflow-hidden text-muted-foreground group-data-focus/option:text-primary-foreground before:w-2 before:min-w-0 before:shrink',
      )}
    >
      <span className="flex-1 truncate">{children}</span>
    </span>
  );
}
