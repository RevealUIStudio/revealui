import type React from 'react';
import { useDataInteractive } from '../hooks/use-data-interactive.js';
import { cn } from '../utils/cn.js';
import { TouchTarget } from './_button-shared.js';
import { Link } from './link.js';

const colors = {
  red: 'bg-red-500/15 text-red-700 group-data-hover:bg-red-500/25',
  orange: 'bg-orange-500/15 text-orange-700 group-data-hover:bg-orange-500/25',
  amber: 'bg-amber-400/20 text-amber-700 group-data-hover:bg-amber-400/30',
  yellow: 'bg-yellow-400/20 text-yellow-700 group-data-hover:bg-yellow-400/30',
  lime: 'bg-lime-400/20 text-lime-700 group-data-hover:bg-lime-400/30',
  green: 'bg-green-500/15 text-green-700 group-data-hover:bg-green-500/25',
  emerald: 'bg-emerald-500/15 text-emerald-700 group-data-hover:bg-emerald-500/25',
  teal: 'bg-teal-500/15 text-teal-700 group-data-hover:bg-teal-500/25',
  cyan: 'bg-cyan-400/20 text-cyan-700 group-data-hover:bg-cyan-400/30',
  sky: 'bg-sky-500/15 text-sky-700 group-data-hover:bg-sky-500/25',
  blue: 'bg-blue-500/15 text-blue-700 group-data-hover:bg-blue-500/25',
  indigo: 'bg-indigo-500/15 text-indigo-700 group-data-hover:bg-indigo-500/25',
  violet: 'bg-violet-500/15 text-violet-700 group-data-hover:bg-violet-500/25',
  purple: 'bg-purple-500/15 text-purple-700 group-data-hover:bg-purple-500/25',
  fuchsia: 'bg-fuchsia-400/15 text-fuchsia-700 group-data-hover:bg-fuchsia-400/25',
  pink: 'bg-pink-400/15 text-pink-700 group-data-hover:bg-pink-400/25',
  rose: 'bg-rose-400/15 text-rose-700 group-data-hover:bg-rose-400/25',
  zinc: 'bg-zinc-600/10 text-zinc-700 group-data-hover:bg-zinc-600/20',
  // Cobalt semantic variants (token-driven; auto-adapt to light/dark via the --rvui-*
  // bridge, so no `dark:` pair is needed). Added so admin/dashboard status badges can
  // track the semantic token system instead of the raw-palette swatches above. The raw
  // palette stays intact (it is the allowlisted product surface per ds-catalyst-reskin).
  brand: 'bg-primary/10 text-primary group-data-hover:bg-primary/20',
  success: 'bg-success/10 text-success group-data-hover:bg-success/20',
  warning: 'bg-warning/10 text-warning-foreground group-data-hover:bg-warning/20',
  danger: 'bg-destructive/10 text-destructive group-data-hover:bg-destructive/20',
  muted: 'bg-muted text-muted-foreground group-data-hover:bg-muted/80',
};

type BadgeProps = { color?: keyof typeof colors };

export function Badge({
  color = 'zinc',
  className,
  ...props
}: BadgeProps & React.ComponentPropsWithoutRef<'span'>) {
  return (
    <span
      {...props}
      className={cn(
        className,
        'inline-flex items-center gap-x-1.5 rounded-md px-1.5 py-0.5 text-sm/5 font-medium sm:text-xs/5 forced-colors:outline',
        colors[color],
      )}
      style={{
        borderRadius: 'var(--rvui-radius-full, 9999px)',
        transition:
          'background-color var(--rvui-duration-fast, 120ms) var(--rvui-ease, cubic-bezier(0.22, 1, 0.36, 1))',
      }}
    />
  );
}

export function BadgeButton({
  color = 'zinc',
  className,
  children,
  ref,
  ...props
}: BadgeProps & { className?: string; children: React.ReactNode; ref?: React.Ref<HTMLElement> } & (
    | ({
        href?: never;
        disabled?: boolean;
      } & Omit<React.ComponentPropsWithoutRef<'button'>, 'className'>)
    | ({ href: string } & Omit<React.ComponentPropsWithoutRef<typeof Link>, 'className'>)
  )) {
  const disabled = 'disabled' in props ? props.disabled : false;
  const interactiveProps = useDataInteractive({ disabled: disabled ?? false });

  const classes = cn(
    className,
    'group relative inline-flex rounded-md focus:not-data-focus:outline-hidden data-focus:outline-2 data-focus:outline-offset-2 data-focus:outline-ring',
  );

  return typeof props.href === 'string' ? (
    <Link {...props} className={classes} ref={ref as React.Ref<HTMLAnchorElement>}>
      <TouchTarget>
        <Badge color={color}>{children}</Badge>
      </TouchTarget>
    </Link>
  ) : (
    <button
      type="button"
      {...props}
      {...interactiveProps}
      className={classes}
      ref={ref as React.Ref<HTMLButtonElement>}
    >
      <TouchTarget>
        <Badge color={color}>{children}</Badge>
      </TouchTarget>
    </button>
  );
}
