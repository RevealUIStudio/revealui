'use client';

import type React from 'react';
import { createContext, use, useCallback, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useClickOutside } from '../hooks/use-click-outside.js';
import { useDataInteractive } from '../hooks/use-data-interactive.js';
import { useEscapeKey } from '../hooks/use-escape-key.js';
import { usePopover } from '../hooks/use-popover.js';
import { useRovingTabindex } from '../hooks/use-roving-tabindex.js';
import { useTransition } from '../hooks/use-transition.js';
import { useTypeAhead } from '../hooks/use-type-ahead.js';
import { cn } from '../utils/cn.js';
import { Button } from './button-headless.js';
import { Link } from './link.js';

// ---------------------------------------------------------------------------
// Dropdown context
// ---------------------------------------------------------------------------

interface DropdownContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  close: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
}

const DropdownContext = createContext<DropdownContextValue | null>(null);

function useDropdownContext(): DropdownContextValue {
  const ctx = use(DropdownContext);
  if (!ctx) {
    throw new Error('Dropdown compound components must be used within <Dropdown>');
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Item context (for roving tabindex coordination)
// ---------------------------------------------------------------------------

interface DropdownItemContextValue {
  register: (el: HTMLElement) => number;
  unregister: (el: HTMLElement) => void;
  getItemProps: (index: number) => {
    tabIndex: number;
    'data-focus': string | undefined;
    ref: (el: HTMLElement | null) => void;
    onPointerEnter: () => void;
    onClick: () => void;
  };
}

const DropdownItemContext = createContext<DropdownItemContextValue | null>(null);

// ---------------------------------------------------------------------------
// Dropdown (root)
// ---------------------------------------------------------------------------

export function Dropdown({
  children,
  ...props
}: {
  children: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<'div'>, 'children'>) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  const value = useMemo(() => ({ open, setOpen, close, triggerRef }), [open, close]);

  return (
    <DropdownContext.Provider value={value}>
      <div {...props}>{children}</div>
    </DropdownContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// DropdownButton
// ---------------------------------------------------------------------------

export function DropdownButton<T extends React.ElementType = typeof Button>({
  as,
  className,
  ...props
}: {
  as?: T;
  className?: string;
} & Omit<React.ComponentPropsWithoutRef<T>, 'className'>) {
  const { open, setOpen, triggerRef } = useDropdownContext();
  const interactiveProps = useDataInteractive();

  const Component = (as ?? Button) as React.ElementType;

  const handleClick = useCallback(() => {
    setOpen(!open);
  }, [open, setOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(true);
      }
    },
    [setOpen],
  );

  return (
    <Component
      ref={triggerRef}
      {...interactiveProps}
      {...props}
      className={className}
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    />
  );
}

// ---------------------------------------------------------------------------
// DropdownMenu
// ---------------------------------------------------------------------------

export function DropdownMenu({
  anchor = 'bottom',
  className,
  children,
  ...props
}: {
  anchor?: 'top' | 'top start' | 'top end' | 'bottom' | 'bottom start' | 'bottom end';
  className?: string;
  children?: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<'div'>, 'className' | 'children'>) {
  const { open, close, triggerRef } = useDropdownContext();
  const { mounted, nodeRef, transitionProps } = useTransition(open);
  const popover = usePopover({
    open,
    anchor,
    gap: 8,
    padding: 4,
  });

  // Combined ref for transition nodeRef + popover popoverRef + local ref
  const menuRef = useRef<HTMLDivElement | null>(null);
  const combinedRef = useCallback(
    (el: HTMLDivElement | null) => {
      menuRef.current = el;
      (popover.popoverRef as React.MutableRefObject<HTMLElement | null>).current = el;
      (nodeRef as React.MutableRefObject<HTMLElement | null>).current = el;
    },
    [popover.popoverRef, nodeRef],
  );

  // Point popover's triggerRef at the dropdown's trigger element
  (popover.triggerRef as React.MutableRefObject<HTMLElement | null>).current = triggerRef.current;

  // Close on click outside (exclude trigger + menu)
  useClickOutside([triggerRef, menuRef] as React.RefObject<HTMLElement | null>[], close, open);

  // Close on Escape
  useEscapeKey(close, open);

  // Track interactive items for roving tabindex
  const itemElements = useRef<HTMLElement[]>([]);
  const [itemCount, setItemCount] = useState(0);

  const register = useCallback((el: HTMLElement): number => {
    if (!itemElements.current.includes(el)) {
      itemElements.current.push(el);
      setItemCount(itemElements.current.length);
    }
    return itemElements.current.indexOf(el);
  }, []);

  const unregister = useCallback((el: HTMLElement): void => {
    const idx = itemElements.current.indexOf(el);
    if (idx !== -1) {
      itemElements.current.splice(idx, 1);
      setItemCount(itemElements.current.length);
    }
  }, []);

  const roving = useRovingTabindex({
    itemCount,
    initialIndex: -1,
    orientation: 'vertical',
    loop: true,
  });

  const typeAhead = useTypeAhead({
    getItemText: (index) => itemElements.current[index]?.textContent ?? '',
    itemCount,
    onMatch: (index) => roving.setActiveIndex(index),
  });

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      roving.containerProps.onKeyDown(e);
      typeAhead.onKeyDown(e);

      // Enter/Space selects the active item
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const activeEl = itemElements.current[roving.activeIndex];
        if (activeEl) {
          activeEl.click();
        }
      }
    },
    [roving, typeAhead],
  );

  const itemContextValue = useMemo<DropdownItemContextValue>(
    () => ({
      register,
      unregister,
      getItemProps: roving.getItemProps,
    }),
    [register, unregister, roving.getItemProps],
  );

  if (!mounted) return null;

  return createPortal(
    <DropdownItemContext.Provider value={itemContextValue}>
      <div
        ref={combinedRef}
        {...transitionProps}
        {...props}
        role="menu"
        aria-orientation="vertical"
        style={popover.popoverProps.style}
        onKeyDown={handleKeyDown}
        className={cn(
          className,
          // Anchor positioning
          '[--anchor-gap:--spacing(2)] [--anchor-padding:--spacing(1)] data-[anchor~=end]:[--anchor-offset:6px] data-[anchor~=start]:[--anchor-offset:-6px] sm:data-[anchor~=end]:[--anchor-offset:4px] sm:data-[anchor~=start]:[--anchor-offset:-4px]',
          // Base styles
          'isolate w-max rounded-xl p-1',
          // Invisible border that is only visible in `forced-colors` mode for accessibility purposes
          'outline outline-transparent focus:outline-hidden',
          // Handle scrolling when menu won't fit in viewport
          'overflow-y-auto',
          // Popover background
          'bg-white/75 backdrop-blur-xl dark:bg-zinc-800/75',
          // Shadows
          'shadow-lg ring-1 ring-zinc-950/10 dark:ring-white/10 dark:ring-inset',
          // Define grid at the menu level if subgrid is supported
          'supports-[grid-template-columns:subgrid]:grid supports-[grid-template-columns:subgrid]:grid-cols-[auto_1fr_1.5rem_0.5rem_auto]',
          // Transitions
          'transition data-leave:duration-100 data-leave:ease-in data-closed:data-leave:opacity-0',
        )}
      >
        {children}
      </div>
    </DropdownItemContext.Provider>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// DropdownItem
// ---------------------------------------------------------------------------

export function DropdownItem({
  className,
  ...props
}: { className?: string } & (
  | ({
      href?: never;
      disabled?: boolean;
      children?: React.ReactNode;
      onClick?: React.MouseEventHandler<HTMLButtonElement>;
    } & Omit<React.ComponentPropsWithoutRef<'button'>, 'className' | 'type'>)
  | ({
      href: string;
      children?: React.ReactNode;
    } & Omit<React.ComponentPropsWithoutRef<typeof Link>, 'className'>)
)) {
  const { close } = useDropdownContext();
  const itemCtx = use(DropdownItemContext);
  const interactiveProps = useDataInteractive({
    disabled: 'disabled' in props ? (props.disabled ?? false) : false,
  });

  const elRef = useRef<HTMLElement | null>(null);
  const indexRef = useRef(-1);

  // Register this item with the roving tabindex system
  const setRef = useCallback(
    (el: HTMLElement | null) => {
      if (el && itemCtx) {
        elRef.current = el;
        indexRef.current = itemCtx.register(el);
      } else if (!el && elRef.current && itemCtx) {
        itemCtx.unregister(elRef.current);
        elRef.current = null;
        indexRef.current = -1;
      }
    },
    [itemCtx],
  );

  const rovingProps =
    itemCtx && indexRef.current >= 0
      ? itemCtx.getItemProps(indexRef.current)
      : {
          tabIndex: -1,
          'data-focus': undefined,
          ref: () => {
            /* no-op */
          },
          onPointerEnter: () => {
            /* no-op */
          },
          onClick: () => {
            /* no-op */
          },
        };

  const propsDisabled = 'disabled' in props ? props.disabled : false;
  const propsOnClick =
    'onClick' in props && typeof props.onClick === 'function'
      ? (props.onClick as (e: React.MouseEvent<HTMLElement>) => void)
      : undefined;

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (propsDisabled) return;
      rovingProps.onClick();
      propsOnClick?.(e);
      close();
    },
    [close, propsDisabled, propsOnClick, rovingProps],
  );

  const classes = cn(
    className,
    // Base styles
    'group cursor-default rounded-lg px-3.5 py-2.5 focus:outline-hidden sm:px-3 sm:py-1.5',
    // Text styles
    'text-left text-base/6 text-zinc-950 sm:text-sm/6 dark:text-white forced-colors:text-[CanvasText]',
    // Focus
    'data-focus:bg-blue-500 data-focus:text-white',
    // Disabled state
    'data-disabled:opacity-50',
    // Forced colors mode
    'forced-color-adjust-none forced-colors:data-focus:bg-[Highlight] forced-colors:data-focus:text-[HighlightText] forced-colors:data-focus:*:data-[slot=icon]:text-[HighlightText]',
    // Use subgrid when available but fallback to an explicit grid layout if not
    'col-span-full grid grid-cols-[auto_1fr_1.5rem_0.5rem_auto] items-center supports-[grid-template-columns:subgrid]:grid-cols-subgrid',
    // Icons
    '*:data-[slot=icon]:col-start-1 *:data-[slot=icon]:row-start-1 *:data-[slot=icon]:mr-2.5 *:data-[slot=icon]:-ml-0.5 *:data-[slot=icon]:size-5 sm:*:data-[slot=icon]:mr-2 sm:*:data-[slot=icon]:size-4',
    '*:data-[slot=icon]:text-zinc-500 data-focus:*:data-[slot=icon]:text-white dark:*:data-[slot=icon]:text-zinc-400 dark:data-focus:*:data-[slot=icon]:text-white',
    // Avatar
    '*:data-[slot=avatar]:mr-2.5 *:data-[slot=avatar]:-ml-1 *:data-[slot=avatar]:size-6 sm:*:data-[slot=avatar]:mr-2 sm:*:data-[slot=avatar]:size-5',
  );

  if (typeof props.href === 'string') {
    const { href, children, ...linkProps } = props as {
      href: string;
      children?: React.ReactNode;
    } & React.ComponentPropsWithoutRef<typeof Link>;

    return (
      <Link
        ref={setRef as React.Ref<HTMLAnchorElement>}
        role="menuitem"
        href={href}
        {...linkProps}
        {...interactiveProps}
        tabIndex={rovingProps.tabIndex}
        data-focus={rovingProps['data-focus']}
        onPointerEnter={rovingProps.onPointerEnter}
        onClick={handleClick as React.MouseEventHandler<HTMLAnchorElement>}
        className={classes}
      >
        {children}
      </Link>
    );
  }

  const {
    disabled,
    children,
    onClick: _onClick,
    ...buttonProps
  } = props as {
    disabled?: boolean;
    children?: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
  } & Omit<React.ComponentPropsWithoutRef<'button'>, 'className' | 'type'>;

  return (
    <button
      ref={setRef as React.Ref<HTMLButtonElement>}
      role="menuitem"
      type="button"
      disabled={disabled}
      {...buttonProps}
      {...interactiveProps}
      tabIndex={rovingProps.tabIndex}
      data-focus={rovingProps['data-focus']}
      onPointerEnter={rovingProps.onPointerEnter}
      onClick={handleClick as React.MouseEventHandler<HTMLButtonElement>}
      className={classes}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// DropdownHeader
// ---------------------------------------------------------------------------

export function DropdownHeader({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return <div {...props} className={cn(className, 'col-span-5 px-3.5 pt-2.5 pb-1 sm:px-3')} />;
}

// ---------------------------------------------------------------------------
// DropdownSection
// ---------------------------------------------------------------------------

export function DropdownSection({
  className,
  ...props
}: {
  className?: string;
} & Omit<React.ComponentPropsWithoutRef<'div'>, 'className'>) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: menu sections intentionally use ARIA group semantics
    <div
      role="group"
      {...props}
      className={cn(
        className,
        // Define grid at the section level instead of the item level if subgrid is supported
        'col-span-full supports-[grid-template-columns:subgrid]:grid supports-[grid-template-columns:subgrid]:grid-cols-[auto_1fr_1.5rem_0.5rem_auto]',
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// DropdownHeading
// ---------------------------------------------------------------------------

export function DropdownHeading({
  className,
  ...props
}: {
  className?: string;
} & Omit<React.ComponentPropsWithoutRef<'div'>, 'className'>) {
  return (
    <div
      role="presentation"
      {...props}
      className={cn(
        className,
        'col-span-full grid grid-cols-[1fr_auto] gap-x-12 px-3.5 pt-2 pb-1 text-sm/5 font-medium text-zinc-500 sm:px-3 sm:text-xs/5 dark:text-zinc-400',
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// DropdownDivider
// ---------------------------------------------------------------------------

export function DropdownDivider({
  className,
  ...props
}: {
  className?: string;
} & Omit<React.ComponentPropsWithoutRef<'hr'>, 'className'>) {
  return (
    <hr
      {...props}
      className={cn(
        className,
        'col-span-full mx-3.5 my-1 h-px border-0 bg-zinc-950/5 sm:mx-3 dark:bg-white/10 forced-colors:bg-[CanvasText]',
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// DropdownLabel
// ---------------------------------------------------------------------------

export function DropdownLabel({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return <div {...props} data-slot="label" className={cn(className, 'col-start-2 row-start-1')} />;
}

// ---------------------------------------------------------------------------
// DropdownDescription
// ---------------------------------------------------------------------------

export function DropdownDescription({
  className,
  ...props
}: {
  className?: string;
} & Omit<React.ComponentPropsWithoutRef<'span'>, 'className'>) {
  return (
    <span
      data-slot="description"
      {...props}
      className={cn(
        className,
        'col-span-2 col-start-2 row-start-2 text-sm/5 text-zinc-500 group-data-focus:text-white sm:text-xs/5 dark:text-zinc-400 forced-colors:group-data-focus:text-[HighlightText]',
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// DropdownShortcut
// ---------------------------------------------------------------------------

export function DropdownShortcut({
  keys,
  className,
  ...props
}: {
  keys: string | string[];
  className?: string;
} & Omit<React.ComponentPropsWithoutRef<'kbd'>, 'className' | 'children'>) {
  return (
    <kbd {...props} className={cn(className, 'col-start-5 row-start-1 flex justify-self-end')}>
      {(Array.isArray(keys) ? keys : keys.split('')).map((char, index) => {
        return (
          <kbd
            // biome-ignore lint/suspicious/noArrayIndexKey: key chars may repeat (e.g. "Ctrl+Ctrl"); index used to disambiguate
            key={`${char}-${index}`}
            className={cn([
              'min-w-[2ch] text-center font-sans text-zinc-400 capitalize group-data-focus:text-white forced-colors:group-data-focus:text-[HighlightText]',
              // Make sure key names that are longer than one character (like "Tab") have extra space
              index > 0 && char.length > 1 && 'pl-1',
            ])}
          >
            {char}
          </kbd>
        );
      })}
    </kbd>
  );
}
