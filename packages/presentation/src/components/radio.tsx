import type React from 'react';
import { createContext, use, useCallback } from 'react';
import { useControllableState } from '../hooks/use-controllable-state.js';
import { useDataInteractive } from '../hooks/use-data-interactive.js';
import { FieldProvider } from '../hooks/use-field-context.js';
import { cn } from '../utils/cn.js';
import { focusRingGroup } from '../utils/focus.js';
import { resolveIntent, type Intent, type LegacyColorway } from '../utils/intent.js';

// --- RadioGroup Context ---
interface RadioGroupContextValue {
  value: string | undefined;
  onChange: (value: string) => void;
  disabled: boolean;
  name?: string;
}

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

function useRadioGroupContext() {
  const ctx = use(RadioGroupContext);
  if (!ctx) throw new Error('Radio must be used within a RadioGroup');
  return ctx;
}

// --- RadioGroup ---
export function RadioGroup({
  className,
  value: controlledValue,
  defaultValue,
  onChange,
  disabled = false,
  name,
  children,
  ...props
}: {
  className?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  name?: string;
  children: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<'div'>, 'className' | 'onChange'>) {
  const [value, setValue] = useControllableState({
    value: controlledValue,
    defaultValue: defaultValue ?? '',
    onChange,
  });

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const radios = Array.from(
        e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]:not([data-disabled])'),
      );
      if (radios.length === 0) return;

      const currentIndex = radios.indexOf(document.activeElement as HTMLElement);
      let nextIndex = currentIndex;

      switch (e.key) {
        case 'ArrowDown':
        case 'ArrowRight':
          e.preventDefault();
          nextIndex = currentIndex + 1 >= radios.length ? 0 : currentIndex + 1;
          break;
        case 'ArrowUp':
        case 'ArrowLeft':
          e.preventDefault();
          nextIndex = currentIndex - 1 < 0 ? radios.length - 1 : currentIndex - 1;
          break;
        case 'Home':
          e.preventDefault();
          nextIndex = 0;
          break;
        case 'End':
          e.preventDefault();
          nextIndex = radios.length - 1;
          break;
        default:
          return;
      }

      const nextRadio = radios[nextIndex];
      if (!nextRadio) return;
      nextRadio.focus();
      const radioValue = nextRadio.getAttribute('data-value');
      if (radioValue != null) {
        setValue(radioValue);
      }
    },
    [setValue],
  );

  return (
    <RadioGroupContext value={{ value, onChange: setValue, disabled, name }}>
      <div
        role="radiogroup"
        data-slot="control"
        onKeyDown={handleKeyDown}
        {...props}
        className={cn(
          className,
          // Basic groups
          'space-y-3 **:data-[slot=label]:font-normal',
          // With descriptions
          'has-data-[slot=description]:space-y-6 has-data-[slot=description]:**:data-[slot=label]:font-medium',
        )}
      >
        {children}
      </div>
    </RadioGroupContext>
  );
}

// --- RadioField ---
export function RadioField({
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

// --- Radio ---
const base = [
  // Basic layout
  'relative isolate flex size-4.75 shrink-0 rounded-full sm:size-4.25',
  // Surface via before pseudo so the shadow blends with the border
  'before:absolute before:inset-0 before:-z-10 before:rounded-full before:bg-card before:shadow-sm',
  // Checked fill
  'group-data-checked:before:bg-(--radio-checked-bg)',
  // Border
  'border border-border-strong group-data-checked:border-transparent group-data-hover:group-data-checked:border-transparent group-data-hover:border-border group-data-checked:bg-(--radio-checked-border)',
  // Inner highlight
  'after:absolute after:inset-0 after:rounded-full after:shadow-[inset_0_1px_--theme(--color-white/15%)]',
  // Indicator
  '[--radio-indicator:transparent] group-data-checked:[--radio-indicator:var(--radio-checked-indicator)] group-data-hover:group-data-checked:[--radio-indicator:var(--radio-checked-indicator)] group-data-hover:[--radio-indicator:var(--rvui-text-2)]',
  // Focus ring
  focusRingGroup,
  // Disabled
  'group-data-disabled:opacity-50',
  'group-data-disabled:border-border group-data-disabled:bg-border group-data-disabled:[--radio-checked-indicator:var(--rvui-text-2)] group-data-disabled:before:bg-transparent',
];

const radioIntentStyles: Record<Intent, string> = {
  brand:
    '[--radio-checked-bg:var(--rvui-brand)] [--radio-checked-border:var(--rvui-brand-strong)] [--radio-checked-indicator:var(--rvui-text-on-brand)]',
  neutral:
    '[--radio-checked-bg:var(--rvui-surface-3)] [--radio-checked-border:var(--rvui-border-strong)] [--radio-checked-indicator:var(--rvui-text-0)]',
  success:
    '[--radio-checked-bg:var(--rvui-success-strong)] [--radio-checked-border:var(--rvui-success)] [--radio-checked-indicator:var(--rvui-text-on-success)]',
  warning:
    '[--radio-checked-bg:var(--rvui-warning)] [--radio-checked-border:var(--rvui-accent-strong)] [--radio-checked-indicator:var(--rvui-text-on-warning)]',
  danger:
    '[--radio-checked-bg:var(--rvui-error)] [--radio-checked-border:var(--rvui-error)] [--radio-checked-indicator:var(--rvui-text-on-error)]',
};

export function Radio({
  intent,
  color,
  className,
  value,
  disabled: localDisabled,
  ...props
}: {
  /** Semantic fill. Default `brand` (was near-black `dark/zinc`). */
  intent?: Intent;
  /** @deprecated Use `intent`. Removed in 0.15. */
  color?: LegacyColorway;
  className?: string;
  value: string;
  disabled?: boolean;
} & Omit<React.ComponentPropsWithoutRef<'span'>, 'className'>) {
  const resolved = resolveIntent({ intent, color, component: 'Radio' });
  const group = useRadioGroupContext();
  const disabled = localDisabled || group.disabled;
  const checked = group.value === value;
  const interactiveProps = useDataInteractive({ disabled });

  const handleClick = useCallback(() => {
    if (!disabled) {
      group.onChange(value);
    }
  }, [disabled, group, value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.key === ' ' || e.key === 'Enter') && !disabled) {
        e.preventDefault();
        group.onChange(value);
      }
    },
    [disabled, group, value],
  );

  return (
    // biome-ignore lint/a11y/useSemanticElements: headless radio intentionally exposes ARIA radio semantics on a custom control
    <span
      role="radio"
      data-slot="control"
      aria-checked={checked}
      data-checked={checked ? '' : undefined}
      data-disabled={disabled ? '' : undefined}
      data-value={value}
      tabIndex={checked ? 0 : -1}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      {...interactiveProps}
      {...props}
      className={cn(className, 'group inline-flex focus:outline-hidden')}
    >
      {group.name && checked && <input type="hidden" name={group.name} value={value} />}
      <span className={cn([base, radioIntentStyles[resolved]])}>
        <span
          className={cn(
            'size-full rounded-full border-[4.5px] border-transparent bg-(--radio-indicator) bg-clip-padding',
            // Forced colors mode
            'forced-colors:border-[Canvas] forced-colors:group-data-checked:border-[Highlight]',
          )}
        />
      </span>
    </span>
  );
}
