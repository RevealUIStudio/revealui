import type React from 'react';
import { useCallback } from 'react';
import { useDataInteractive } from '../hooks/use-data-interactive.js';
import { FieldProvider } from '../hooks/use-field-context.js';
import { useToggle } from '../hooks/use-toggle.js';
import { cn } from '../utils/cn.js';
import { focusRingGroup } from '../utils/focus.js';
import { resolveIntent, type Intent, type LegacyColorway } from '../utils/intent.js';

export function CheckboxGroup({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      data-slot="control"
      {...props}
      className={cn(
        className,
        // Basic groups
        'space-y-3',
        // With descriptions
        'has-data-[slot=description]:space-y-6 has-data-[slot=description]:**:data-[slot=label]:font-medium',
      )}
    />
  );
}

export function CheckboxField({
  className,
  disabled,
  ...props
}: {
  className?: string;
  disabled?: boolean;
} & Omit<React.ComponentPropsWithoutRef<'div'>, 'className'>) {
  return (
    <FieldProvider disabled={disabled}>
      <div
        data-slot="field"
        data-disabled={disabled ? '' : undefined}
        {...props}
        className={cn(
          className,
          // Base layout
          'grid grid-cols-[1.125rem_1fr] gap-x-4 gap-y-1 sm:grid-cols-[1rem_1fr]',
          // Control layout
          '*:data-[slot=control]:col-start-1 *:data-[slot=control]:row-start-1 *:data-[slot=control]:mt-0.75 sm:*:data-[slot=control]:mt-1',
          // Label layout
          '*:data-[slot=label]:col-start-2 *:data-[slot=label]:row-start-1',
          // Description layout
          '*:data-[slot=description]:col-start-2 *:data-[slot=description]:row-start-2',
          // With description
          'has-data-[slot=description]:**:data-[slot=label]:font-medium',
        )}
      />
    </FieldProvider>
  );
}

const base = [
  // Basic layout
  'relative isolate flex size-4.5 items-center justify-center rounded-[0.3125rem] sm:size-4',
  // Surface via before pseudo so the shadow blends with the border
  'before:absolute before:inset-0 before:-z-10 before:rounded-[calc(0.3125rem-1px)] before:bg-card before:shadow-sm',
  // Checked fill
  'group-data-checked:before:bg-(--checkbox-checked-bg)',
  // Border
  'border border-border-strong group-data-checked:border-transparent group-data-hover:group-data-checked:border-transparent group-data-hover:border-border group-data-checked:bg-(--checkbox-checked-border)',
  // Inner highlight
  'after:absolute after:inset-0 after:rounded-[calc(0.3125rem-1px)] after:shadow-[inset_0_1px_--theme(--color-white/15%)]',
  // Focus ring
  focusRingGroup,
  // Disabled
  'group-data-disabled:opacity-50',
  'group-data-disabled:border-border group-data-disabled:bg-border group-data-disabled:[--checkbox-check:var(--rvui-text-2)] group-data-disabled:before:bg-transparent',
  // Forced colors
  'forced-colors:[--checkbox-check:HighlightText] forced-colors:[--checkbox-checked-bg:Highlight] forced-colors:group-data-disabled:[--checkbox-check:Highlight]',
];

const checkboxIntentStyles: Record<Intent, string> = {
  brand:
    '[--checkbox-check:var(--rvui-text-on-brand)] [--checkbox-checked-bg:var(--rvui-brand)] [--checkbox-checked-border:var(--rvui-brand-strong)]',
  neutral:
    '[--checkbox-check:var(--rvui-text-0)] [--checkbox-checked-bg:var(--rvui-surface-3)] [--checkbox-checked-border:var(--rvui-border-strong)]',
  success:
    '[--checkbox-check:var(--rvui-text-on-success)] [--checkbox-checked-bg:var(--rvui-success-strong)] [--checkbox-checked-border:var(--rvui-success)]',
  warning:
    '[--checkbox-check:var(--rvui-text-on-warning)] [--checkbox-checked-bg:var(--rvui-warning)] [--checkbox-checked-border:var(--rvui-accent-strong)]',
  danger:
    '[--checkbox-check:var(--rvui-text-on-error)] [--checkbox-checked-bg:var(--rvui-error)] [--checkbox-checked-border:var(--rvui-error)]',
};

export function Checkbox({
  intent,
  color,
  className,
  checked: controlledChecked,
  defaultChecked,
  onChange,
  disabled,
  indeterminate,
  name,
  value,
  ...props
}: {
  /** Semantic fill. Default `brand` (was near-black `dark/zinc`). */
  intent?: Intent;
  /** @deprecated Use `intent`. Removed in 0.15. */
  color?: LegacyColorway;
  className?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  indeterminate?: boolean;
  name?: string;
  value?: string;
} & Omit<React.ComponentPropsWithoutRef<'span'>, 'className' | 'onChange'>) {
  const resolved = resolveIntent({ intent, color, component: 'Checkbox' });
  const { checked, toggleProps } = useToggle({
    checked: controlledChecked,
    defaultChecked,
    onChange,
    disabled,
  });
  const interactiveProps = useDataInteractive({ disabled });

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault();
        toggleProps.onKeyDown(e);
      }
    },
    [toggleProps],
  );

  return (
    // biome-ignore lint/a11y/useSemanticElements: headless checkbox intentionally exposes checkbox semantics on a custom control
    <span
      data-slot="control"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      data-checked={checked ? '' : undefined}
      data-indeterminate={indeterminate ? '' : undefined}
      data-disabled={disabled ? '' : undefined}
      tabIndex={disabled ? undefined : 0}
      onClick={disabled ? undefined : toggleProps.onClick}
      onKeyDown={disabled ? undefined : handleKeyDown}
      {...interactiveProps}
      {...props}
      className={cn(className, 'group inline-flex focus:outline-hidden')}
    >
      {name && <input type="hidden" name={name} value={checked ? (value ?? 'on') : ''} />}
      <span className={cn([base, checkboxIntentStyles[resolved]])}>
        <svg
          className="size-4 stroke-(--checkbox-check) opacity-0 group-data-checked:opacity-100 sm:h-3.5 sm:w-3.5"
          viewBox="0 0 14 14"
          fill="none"
        >
          <title>Checkmark</title>
          {/* Checkmark icon */}
          <path
            className="opacity-100 group-data-indeterminate:opacity-0"
            d="M3 8L6 11L11 3.5"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Indeterminate icon */}
          <path
            className="opacity-0 group-data-indeterminate:opacity-100"
            d="M3 7H11"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </span>
  );
}
