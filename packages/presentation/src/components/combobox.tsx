'use client';

import type React from 'react';
import { createContext, use, useCallback, useEffect, useId, useRef, useState } from 'react';
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

interface ComboboxContextValue<T = unknown> {
  selectedValue: T | null;
  activeIndex: number;
  filteredOptions: T[];
  select: (value: T) => void;
  setActiveIndex: (index: number) => void;
}

const ComboboxContext = createContext<ComboboxContextValue | null>(null);

function useComboboxContext(): ComboboxContextValue {
  const ctx = use(ComboboxContext);
  if (!ctx) {
    throw new Error('Combobox compound components must be used within <Combobox>');
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Combobox
// ---------------------------------------------------------------------------

export function Combobox<T>({
  options,
  displayValue,
  filter,
  anchor = 'bottom',
  className,
  placeholder,
  autoFocus = false,
  'aria-label': ariaLabel,
  children,
  value: controlledValue,
  defaultValue,
  onChange,
  disabled = false,
  name,
}: {
  options: T[];
  displayValue: (value: T | null) => string | undefined;
  filter?: (value: T, query: string) => boolean;
  className?: string;
  placeholder?: string | undefined;
  autoFocus?: boolean | undefined;
  'aria-label'?: string;
  children: (value: NonNullable<T>) => React.ReactElement;
  value?: T | null;
  defaultValue?: T | null;
  onChange?: (value: T) => void;
  disabled?: boolean;
  name?: string;
  anchor?: 'top' | 'bottom';
}) {
  const [selectedValue, setSelectedValue] = useControllableState<T | null>({
    value: controlledValue,
    defaultValue: defaultValue ?? null,
    onChange: onChange as ((value: T | null) => void) | undefined,
  });

  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const controlRef = useRef<HTMLSpanElement>(null);
  const listboxId = useId();

  // Filtering
  const filteredOptions =
    query === ''
      ? options
      : options.filter((option) =>
          filter
            ? filter(option, query)
            : displayValue(option)?.toLowerCase().includes(query.toLowerCase()),
        );

  // Popover positioning
  const { triggerRef, popoverRef, popoverProps } = usePopover({
    open: isOpen,
    anchor,
    gap: 8,
    padding: 16,
  });

  // Sync control span as the trigger
  useEffect(() => {
    if (controlRef.current) {
      (triggerRef as React.MutableRefObject<HTMLElement | null>).current = controlRef.current;
    }
  }, [triggerRef]);

  useEffect(() => {
    if (autoFocus && !disabled) {
      inputRef.current?.focus();
    }
  }, [autoFocus, disabled]);

  // Transition
  const { mounted, nodeRef: transitionRef, transitionProps } = useTransition(isOpen);

  // Dismiss handlers
  useClickOutside(
    [controlRef, popoverRef],
    () => {
      if (isOpen) close();
    },
    isOpen,
  );

  useEscapeKey(() => {
    if (isOpen) close();
  }, isOpen);

  // Helpers
  const open = useCallback(() => {
    if (disabled) return;
    setIsOpen(true);
    setActiveIndex(-1);
  }, [disabled]);

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setActiveIndex(-1);
  }, []);

  const select = useCallback(
    (value: T) => {
      setSelectedValue(value);
      close();
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    },
    [setSelectedValue, close],
  );

  // Keyboard navigation
  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          if (!isOpen) {
            open();
          } else {
            setActiveIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
          }
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          if (!isOpen) {
            open();
          } else {
            setActiveIndex((prev) => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
          }
          break;
        }
        case 'Home': {
          if (isOpen) {
            e.preventDefault();
            setActiveIndex(0);
          }
          break;
        }
        case 'End': {
          if (isOpen) {
            e.preventDefault();
            setActiveIndex(filteredOptions.length - 1);
          }
          break;
        }
        case 'Enter': {
          e.preventDefault();
          if (isOpen && activeIndex >= 0 && activeIndex < filteredOptions.length) {
            select(filteredOptions[activeIndex] as T);
          }
          break;
        }
        case 'Tab': {
          if (isOpen) {
            close();
          }
          break;
        }
      }
    },
    [isOpen, open, close, select, activeIndex, filteredOptions],
  );

  // Scroll active option into view
  useEffect(() => {
    if (!isOpen || activeIndex < 0) return;
    const listbox = popoverRef.current;
    if (!listbox) return;
    const activeOption = listbox.querySelector(`[data-combobox-option-index="${activeIndex}"]`);
    if (activeOption) {
      activeOption.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex, isOpen, popoverRef]);

  // Context value
  const contextValue: ComboboxContextValue<T> = {
    selectedValue,
    activeIndex,
    filteredOptions,
    select: select as (value: unknown) => void,
    setActiveIndex,
  };

  return (
    <ComboboxContext.Provider value={contextValue as ComboboxContextValue}>
      <span
        ref={controlRef}
        data-slot="control"
        {...(disabled ? { 'data-disabled': '' } : {})}
        className={cn([
          className,
          'relative block w-full',
          'before:absolute before:inset-px before:rounded-[calc(var(--radius-lg)-1px)] before:bg-white before:shadow-sm',
          'dark:before:hidden',
          'after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:ring-transparent after:ring-inset sm:focus-within:after:ring-2 sm:focus-within:after:ring-blue-500',
          'has-data-disabled:opacity-50 has-data-disabled:before:bg-zinc-950/5 has-data-disabled:before:shadow-none',
          'has-data-invalid:before:shadow-red-500/10',
        ])}
      >
        <input
          ref={inputRef}
          data-slot="control"
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-activedescendant={
            isOpen && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
          }
          aria-autocomplete="list"
          aria-haspopup="listbox"
          disabled={disabled}
          name={name}
          value={isOpen ? query : (displayValue(selectedValue) ?? '')}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) open();
            setActiveIndex(-1);
          }}
          onFocus={() => {
            if (!isOpen) open();
          }}
          onKeyDown={handleInputKeyDown}
          placeholder={placeholder}
          {...(disabled ? { 'data-disabled': '' } : {})}
          className={cn([
            className,
            'relative block w-full appearance-none rounded-lg py-[calc(--spacing(2.5)-1px)] sm:py-[calc(--spacing(1.5)-1px)]',
            'pr-[calc(--spacing(10)-1px)] pl-[calc(--spacing(3.5)-1px)] sm:pr-[calc(--spacing(9)-1px)] sm:pl-[calc(--spacing(3)-1px)]',
            'text-base/6 text-zinc-950 placeholder:text-zinc-500 sm:text-sm/6 dark:text-white',
            'border border-zinc-950/10 data-hover:border-zinc-950/20 dark:border-white/10 dark:data-hover:border-white/20',
            'bg-transparent dark:bg-white/5',
            'focus:outline-hidden',
            'data-invalid:border-red-500 data-invalid:data-hover:border-red-500 dark:data-invalid:border-red-500 dark:data-invalid:data-hover:border-red-500',
            'data-disabled:border-zinc-950/20 dark:data-disabled:border-white/15 dark:data-disabled:bg-white/2.5 dark:data-hover:data-disabled:border-white/15',
            'dark:scheme-dark',
          ])}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label="Toggle options"
          disabled={disabled}
          onClick={() => {
            if (isOpen) {
              close();
            } else {
              open();
              inputRef.current?.focus();
            }
          }}
          className="group absolute inset-y-0 right-0 flex items-center px-2"
          {...(disabled ? { 'data-disabled': '' } : {})}
        >
          <svg
            className="size-5 stroke-zinc-500 group-data-disabled:stroke-zinc-600 group-data-hover:stroke-zinc-700 sm:size-4 dark:stroke-zinc-400 dark:group-data-hover:stroke-zinc-300 forced-colors:stroke-[CanvasText]"
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
        </button>
      </span>

      {/* Options panel via portal */}
      {mounted &&
        createPortal(
          <div
            ref={(node) => {
              (popoverRef as React.MutableRefObject<HTMLElement | null>).current = node;
              (transitionRef as React.MutableRefObject<HTMLElement | null>).current = node;
            }}
            role="listbox"
            id={listboxId}
            {...popoverProps}
            {...transitionProps}
            className={cn(
              '[--anchor-gap:--spacing(2)] [--anchor-padding:--spacing(4)] sm:data-[anchor~=start]:[--anchor-offset:-4px]',
              'isolate min-w-[calc(var(--input-width)+8px)] scroll-py-1 rounded-xl p-1 select-none empty:invisible',
              'outline outline-transparent focus:outline-hidden',
              'overflow-y-scroll overscroll-contain',
              'bg-white/75 backdrop-blur-xl dark:bg-zinc-800/75',
              'shadow-lg ring-1 ring-zinc-950/10 dark:ring-white/10 dark:ring-inset',
              'transition-opacity duration-100 ease-in data-closed:data-leave:opacity-0 data-transition:pointer-events-none',
            )}
            style={{
              ...popoverProps.style,
              minWidth: controlRef.current?.offsetWidth,
            }}
          >
            {filteredOptions.map((option, index) =>
              option == null ? null : (
                // biome-ignore lint/suspicious/noArrayIndexKey: filtered options have no stable ID
                <ComboboxOptionIndexProvider key={index} index={index}>
                  {children(option)}
                </ComboboxOptionIndexProvider>
              ),
            )}
          </div>,
          document.body,
        )}
    </ComboboxContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Internal: option index provider
// ---------------------------------------------------------------------------

const ComboboxOptionIndexContext = createContext<number>(-1);

function ComboboxOptionIndexProvider({
  index,
  children,
}: {
  index: number;
  children: React.ReactNode;
}) {
  return (
    <ComboboxOptionIndexContext.Provider value={index}>
      {children}
    </ComboboxOptionIndexContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// ComboboxOption
// ---------------------------------------------------------------------------

export function ComboboxOption<T>({
  children,
  className,
  value,
  disabled = false,
}: {
  className?: string;
  children?: React.ReactNode;
  value: T;
  disabled?: boolean;
}) {
  const { selectedValue, activeIndex, select, setActiveIndex } = useComboboxContext();
  const index = use(ComboboxOptionIndexContext);

  const isSelected = selectedValue === value;
  const isActive = activeIndex === index;

  const sharedClasses = cn(
    'flex min-w-0 items-center',
    '*:data-[slot=icon]:size-5 *:data-[slot=icon]:shrink-0 sm:*:data-[slot=icon]:size-4',
    '*:data-[slot=icon]:text-zinc-500 group-data-focus/option:*:data-[slot=icon]:text-white dark:*:data-[slot=icon]:text-zinc-400',
    'forced-colors:*:data-[slot=icon]:text-[CanvasText] forced-colors:group-data-focus/option:*:data-[slot=icon]:text-[Canvas]',
    '*:data-[slot=avatar]:-mx-0.5 *:data-[slot=avatar]:size-6 sm:*:data-[slot=avatar]:size-5',
  );

  return (
    // biome-ignore lint/a11y/useFocusableInteractive: focus managed by roving tabindex
    // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard selection is handled by the parent combobox input
    <div
      role="option"
      aria-selected={isSelected}
      aria-disabled={disabled}
      data-combobox-option-index={index}
      {...(isActive ? { 'data-focus': '' } : {})}
      {...(isSelected ? { 'data-selected': '' } : {})}
      {...(disabled ? { 'data-disabled': '' } : {})}
      onPointerEnter={() => {
        if (!disabled) setActiveIndex(index);
      }}
      onPointerLeave={() => {
        setActiveIndex(-1);
      }}
      onClick={() => {
        if (!disabled) select(value);
      }}
      className={cn(
        'group/option grid w-full cursor-default grid-cols-[1fr_--spacing(5)] items-baseline gap-x-2 rounded-lg py-2.5 pr-2 pl-3.5 sm:grid-cols-[1fr_--spacing(4)] sm:py-1.5 sm:pr-2 sm:pl-3',
        'text-base/6 text-zinc-950 sm:text-sm/6 dark:text-white forced-colors:text-[CanvasText]',
        'outline-hidden data-focus:bg-blue-500 data-focus:text-white',
        'forced-color-adjust-none forced-colors:data-focus:bg-[Highlight] forced-colors:data-focus:text-[HighlightText]',
        'data-disabled:opacity-50',
      )}
    >
      <span className={cn(className, sharedClasses)}>{children}</span>
      <svg
        className="relative col-start-2 hidden size-5 self-center stroke-current group-data-selected/option:inline sm:size-4"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <path d="M4 8.5l3 3L12 4" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ComboboxLabel
// ---------------------------------------------------------------------------

export function ComboboxLabel({ className, ...props }: React.ComponentPropsWithoutRef<'span'>) {
  return (
    <span
      {...props}
      className={cn(className, 'ml-2.5 truncate first:ml-0 sm:ml-2 sm:first:ml-0')}
    />
  );
}

// ---------------------------------------------------------------------------
// ComboboxDescription
// ---------------------------------------------------------------------------

export function ComboboxDescription({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<'span'>) {
  return (
    <span
      {...props}
      className={cn(
        className,
        'flex flex-1 overflow-hidden text-zinc-500 group-data-focus/option:text-white before:w-2 before:min-w-0 before:shrink dark:text-zinc-400',
      )}
    >
      <span className="flex-1 truncate">{children}</span>
    </span>
  );
}
