import type React from 'react';
import { useDataInteractive } from '../hooks/use-data-interactive.js';
import { FieldProvider } from '../hooks/use-field-context.js';
import { useToggle } from '../hooks/use-toggle.js';
import { cn } from '../utils/cn.js';
import { focusRingData } from '../utils/focus.js';
import { resolveIntent, type Intent, type LegacyColorway } from '../utils/intent.js';

export function SwitchGroup({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      data-slot="control"
      {...props}
      className={cn(
        className,
        // Basic groups
        'space-y-3 **:data-[slot=label]:font-normal',
        // With descriptions
        'has-data-[slot=description]:space-y-6 has-data-[slot=description]:**:data-[slot=label]:font-medium',
      )}
    />
  );
}

export function SwitchField({
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
          'grid grid-cols-[1fr_auto] gap-x-8 gap-y-1 sm:grid-cols-[1fr_auto]',
          // Control layout
          '*:data-[slot=control]:col-start-2 *:data-[slot=control]:self-start sm:*:data-[slot=control]:mt-0.5',
          // Label layout
          '*:data-[slot=label]:col-start-1 *:data-[slot=label]:row-start-1',
          // Description layout
          '*:data-[slot=description]:col-start-1 *:data-[slot=description]:row-start-2',
          // With description
          'has-data-[slot=description]:**:data-[slot=label]:font-medium',
        )}
      />
    </FieldProvider>
  );
}

/**
 * Five semantic intents replace the Catalyst 11-colorway palette API.
 * Default is `brand` (cobalt) — previously `dark/zinc` (near-black). Call that
 * out in the changeset; unstyled consumers will see a different default fill.
 */
const intentStyles: Record<Intent, string> = {
  brand:
    '[--switch-bg:var(--rvui-brand)] [--switch-bg-ring:var(--rvui-brand-strong)] ' +
    '[--switch:var(--rvui-text-on-brand)] [--switch-ring:var(--rvui-brand-strong)] ' +
    '[--switch-shadow:var(--rvui-brand-glow)]',
  neutral:
    '[--switch-bg:var(--rvui-surface-3)] [--switch-bg-ring:var(--rvui-border-strong)] ' +
    '[--switch:var(--rvui-text-0)] [--switch-ring:var(--rvui-border-strong)] ' +
    '[--switch-shadow:transparent]',
  success:
    '[--switch-bg:var(--rvui-success-strong)] [--switch-bg-ring:var(--rvui-success)] ' +
    '[--switch:var(--rvui-text-on-success)] [--switch-ring:var(--rvui-success)] ' +
    '[--switch-shadow:transparent]',
  warning:
    '[--switch-bg:var(--rvui-warning)] [--switch-bg-ring:var(--rvui-accent-strong)] ' +
    '[--switch:var(--rvui-text-on-warning)] [--switch-ring:var(--rvui-accent-strong)] ' +
    '[--switch-shadow:transparent]',
  danger:
    '[--switch-bg:var(--rvui-error)] [--switch-bg-ring:var(--rvui-error)] ' +
    '[--switch:var(--rvui-text-on-error)] [--switch-ring:var(--rvui-error)] ' +
    '[--switch-shadow:transparent]',
};

export function Switch({
  intent,
  color,
  className,
  checked: controlledChecked,
  defaultChecked,
  onChange,
  disabled,
  name,
  value,
  ...props
}: {
  /** Semantic fill. Default `brand` (was near-black `dark/zinc`). */
  intent?: Intent;
  /**
   * @deprecated Use `intent`. Mapped for two minors (through 0.15).
   * See SEMANTIC-INTENTS.md.
   */
  color?: LegacyColorway;
  className?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  name?: string;
  value?: string;
} & Omit<React.ComponentPropsWithoutRef<'button'>, 'className' | 'onChange' | 'type'>) {
  const resolved = resolveIntent({ intent, color, component: 'Switch' });
  const { checked, toggleProps } = useToggle({
    checked: controlledChecked,
    defaultChecked,
    onChange,
    disabled,
  });
  const interactiveProps = useDataInteractive({ disabled });

  return (
    <button
      type="button"
      role="switch"
      data-slot="control"
      aria-checked={checked}
      data-checked={checked ? '' : undefined}
      data-disabled={disabled ? '' : undefined}
      disabled={disabled}
      onClick={toggleProps.onClick}
      onKeyDown={toggleProps.onKeyDown}
      {...interactiveProps}
      {...props}
      className={cn(
        className,
        // Base styles
        'group relative isolate inline-flex h-6 w-10 cursor-default rounded-full p-[3px] sm:h-5 sm:w-8',
        // Transitions
        'transition duration-0 ease-in-out data-changing:duration-200',
        // Forced-colors: keep the track visible under Windows high-contrast
        'forced-colors:outline forced-colors:[--switch-bg:Highlight]',
        // Unchecked track (tokens invert with [data-theme]; no dark: pair)
        'bg-surface-2 ring-1 ring-border ring-inset',
        // Checked
        'data-checked:bg-(--switch-bg) data-checked:ring-(--switch-bg-ring)',
        // Focus
        focusRingData,
        // Hover
        'data-hover:ring-border-strong data-hover:data-checked:ring-(--switch-bg-ring)',
        // Disabled
        'data-disabled:bg-surface-2 data-disabled:opacity-50 data-disabled:data-checked:bg-surface-2 data-disabled:data-checked:ring-border',
        // Intent fill vars
        intentStyles[resolved],
      )}
    >
      {name && <input type="hidden" name={name} value={checked ? (value ?? 'on') : ''} />}
      <span
        aria-hidden="true"
        className={cn(
          // Basic layout
          'pointer-events-none relative inline-block size-4.5 rounded-full sm:size-3.5',
          // Transition
          'translate-x-0 transition duration-200 ease-in-out',
          // Invisible border so the switch is still visible in forced-colors mode
          'border border-transparent',
          // Unchecked
          'bg-card shadow-sm ring-1 ring-border',
          // Checked
          'group-data-checked:bg-(--switch) group-data-checked:shadow-(--switch-shadow) group-data-checked:ring-(--switch-ring)',
          'group-data-checked:translate-x-4 sm:group-data-checked:translate-x-3',
          // Disabled
          'group-data-checked:group-data-disabled:bg-card group-data-checked:group-data-disabled:shadow-sm group-data-checked:group-data-disabled:ring-border',
        )}
      />
    </button>
  );
}
