import type React from 'react';
import { useDataInteractive } from '../hooks/use-data-interactive.js';
import { cn } from '../utils/cn.js';
import { focusRingData } from '../utils/focus.js';
import { TouchTarget } from './_button-shared.js';
import { Link } from './link.js';

/**
 * `DropdownTriggerButton` — the internal trigger primitive that `Dropdown`
 * composes. Not part of the public component surface; consumers use `Button`
 * (Button.tsx) for actions and `DropdownButton` for a menu trigger.
 *
 * It renders a real `<button>` (or an anchor when `href` is set) and keeps the
 * package's `data-*` interaction contract (`data-hover` / `data-active` /
 * `data-focus` / `data-disabled` from `useDataInteractive`) because menu-class
 * widgets coordinate their styling through those attributes rather than native
 * pseudo-classes. Styling is entirely token-driven: neutral surface, `--border`
 * outline, `--ring` focus ring, `--muted-foreground` icons.
 */

const triggerClasses = [
  // Base
  'relative isolate inline-flex items-center justify-center gap-x-2 rounded-[var(--rvui-radius-md)] border border-[var(--border)] text-sm font-medium cursor-default',
  // Sizing
  'px-3.5 py-2.5 sm:px-3 sm:py-1.5',
  // Neutral token surface + interaction states via the data-* contract
  'bg-secondary text-secondary-foreground shadow-sm data-hover:bg-secondary/80 data-active:bg-secondary/70',
  focusRingData,
  // Disabled
  'data-disabled:opacity-50',
  // Icon slot
  '*:data-[slot=icon]:-mx-0.5 *:data-[slot=icon]:size-5 *:data-[slot=icon]:shrink-0 *:data-[slot=icon]:self-center *:data-[slot=icon]:text-[var(--muted-foreground)] sm:*:data-[slot=icon]:size-4 forced-colors:*:data-[slot=icon]:text-[ButtonText]',
];

type DropdownTriggerButtonProps = {
  className?: string;
  children: React.ReactNode;
  ref?: React.Ref<HTMLElement>;
} & (
  | ({
      href?: never;
      disabled?: boolean;
      type?: 'button' | 'submit' | 'reset';
    } & Omit<React.ComponentPropsWithoutRef<'button'>, 'className' | 'type'>)
  | ({ href: string } & Omit<React.ComponentPropsWithoutRef<typeof Link>, 'className'>)
);

export function DropdownTriggerButton({
  className,
  children,
  ref,
  ...props
}: DropdownTriggerButtonProps) {
  const disabled = 'disabled' in props ? (props.disabled ?? false) : false;
  const interactiveProps = useDataInteractive({ disabled });

  const classes = cn(className, triggerClasses);

  return typeof props.href === 'string' ? (
    <Link {...props} className={classes} ref={ref as React.Ref<HTMLAnchorElement>}>
      <TouchTarget>{children}</TouchTarget>
    </Link>
  ) : (
    <button
      type="button"
      {...props}
      {...interactiveProps}
      className={classes}
      ref={ref as React.Ref<HTMLButtonElement>}
    >
      <TouchTarget>{children}</TouchTarget>
    </button>
  );
}
