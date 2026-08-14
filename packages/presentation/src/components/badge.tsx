import type React from 'react';
import { cn } from '../utils/cn.js';
import { focusRing } from '../utils/focus.js';
import { type Intent, LEGACY_COLOR_TO_INTENT, type LegacyColorway } from '../utils/intent.js';
import { TouchTarget } from './_button-shared.js';
import { Link } from './link.js';

/**
 * Badge — owned RevealUI status chip.
 *
 * `intent` is the semantic colour (brand, neutral, success, warning, danger,
 * plus `muted` for metadata tags). Styles come from the `--rvui-*` / `@theme`
 * bridge only. The Catalyst 20-swatch `color` palette is gone; `color` remains
 * as a deprecated alias through 0.15.
 */

export type BadgeIntent = Intent | 'muted';

const INTENT_STYLES: Record<BadgeIntent, string> = {
  brand: 'bg-primary/10 text-primary group-hover:bg-primary/20',
  danger: 'bg-destructive/10 text-destructive group-hover:bg-destructive/20',
  muted: 'bg-muted text-muted-foreground group-hover:bg-muted/80',
  neutral: 'bg-muted text-muted-foreground group-hover:bg-muted/80',
  success: 'bg-success/10 text-success group-hover:bg-success/20',
  warning: 'bg-warning/10 text-warning-foreground group-hover:bg-warning/20',
};

const BADGE_INTENTS = new Set<string>(Object.keys(INTENT_STYLES));

const warned = new Set<string>();

function isBadgeIntent(value: string): value is BadgeIntent {
  return BADGE_INTENTS.has(value);
}

/**
 * Resolve the chip intent. `intent` wins. Deprecated `color` maps either an
 * already-semantic name or a Catalyst colorway, then warns once per pair.
 */
export function resolveBadgeIntent(opts: {
  intent?: BadgeIntent;
  color?: string;
  component?: string;
}): BadgeIntent {
  if (opts.intent) return opts.intent;
  if (!opts.color) return 'neutral';

  const next = isBadgeIntent(opts.color)
    ? opts.color
    : (LEGACY_COLOR_TO_INTENT[opts.color as LegacyColorway] ?? 'neutral');

  if (process.env.NODE_ENV !== 'production') {
    const component = opts.component ?? 'Badge';
    const key = `${component}:${opts.color}`;
    if (!warned.has(key)) {
      warned.add(key);
      const msg =
        `[RevealUI] ${component}: the \`color\` prop is deprecated and will be removed in 0.15. ` +
        `Use \`intent\` instead: color="${opts.color}" → intent="${next}".`;
      // biome-ignore lint/suspicious/noConsole: one-shot deprecation surface through 0.15
      console.warn(msg); // console-allowed
    }
  }

  return next;
}

export interface BadgeProps extends React.ComponentPropsWithoutRef<'span'> {
  /** Semantic fill. Default `neutral` (was palette `zinc`). */
  intent?: BadgeIntent;
  /**
   * @deprecated Use `intent`. Mapped for two minors (through 0.15).
   */
  color?: BadgeIntent | LegacyColorway;
}

export function Badge({ intent, color, className, ...props }: BadgeProps): React.ReactElement {
  const resolved = resolveBadgeIntent({ intent, color, component: 'Badge' });
  return (
    <span
      {...props}
      className={cn(
        'inline-flex items-center gap-x-1.5 rounded-[var(--rvui-radius-full,9999px)] px-1.5 py-0.5 text-sm/5 font-medium sm:text-xs/5 forced-colors:outline',
        INTENT_STYLES[resolved],
        className,
      )}
      style={{
        transition:
          'background-color var(--rvui-duration-fast, 120ms) var(--rvui-ease, cubic-bezier(0.22, 1, 0.36, 1))',
      }}
    />
  );
}

export type BadgeButtonProps = {
  intent?: BadgeIntent;
  /** @deprecated Use `intent`. Mapped through 0.15. */
  color?: BadgeIntent | LegacyColorway;
  className?: string;
  children: React.ReactNode;
  ref?: React.Ref<HTMLElement>;
} & (
  | ({
      href?: never;
      disabled?: boolean;
    } & Omit<React.ComponentPropsWithoutRef<'button'>, 'className' | 'color'>)
  | ({ href: string } & Omit<React.ComponentPropsWithoutRef<typeof Link>, 'className' | 'color'>)
);

export function BadgeButton({
  intent,
  color,
  className,
  children,
  ref,
  ...props
}: BadgeButtonProps): React.ReactElement {
  const resolved = resolveBadgeIntent({ intent, color, component: 'BadgeButton' });
  const classes = cn(
    'group relative inline-flex rounded-[var(--rvui-radius-full,9999px)]',
    focusRing,
    className,
  );

  return typeof props.href === 'string' ? (
    <Link {...props} className={classes} ref={ref as React.Ref<HTMLAnchorElement>}>
      <TouchTarget>
        <Badge intent={resolved}>{children}</Badge>
      </TouchTarget>
    </Link>
  ) : (
    <button type="button" {...props} className={classes} ref={ref as React.Ref<HTMLButtonElement>}>
      <TouchTarget>
        <Badge intent={resolved}>{children}</Badge>
      </TouchTarget>
    </button>
  );
}
