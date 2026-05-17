import type React from 'react';
import { cn } from '../utils/cn.js';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  ref?: React.Ref<HTMLInputElement>;
};

function Input({ type, className, ref, ...props }: InputProps) {
  return (
    <input
      className={cn(
        // Layout + typography
        'flex h-10 w-full rounded border bg-background px-3 py-2 text-sm',
        // Border — solid hex tokens (not alpha-translucent OKLCH) for crisp sub-pixel rendering
        'border-zinc-300 dark:border-zinc-700',
        // Hover affordance
        'hover:border-zinc-400 dark:hover:border-zinc-600',
        // Focus — brand-tinted border + ring derived from --tenant-brand (fallback to --ring)
        'focus-visible:outline-none focus-visible:border-[var(--tenant-brand,var(--ring))] focus-visible:ring-2 focus-visible:ring-[var(--tenant-brand,var(--ring))] focus-visible:ring-offset-2',
        // Error state (consumers set aria-invalid on the input)
        'aria-invalid:border-red-500 aria-invalid:ring-red-500',
        // Disabled state — keep border neutral on hover when disabled
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-zinc-300 dark:disabled:hover:border-zinc-700',
        // Read-only state — slightly tinted bg, no hover affordance
        'read-only:bg-zinc-50 dark:read-only:bg-zinc-900 read-only:cursor-default read-only:hover:border-zinc-300 dark:read-only:hover:border-zinc-700',
        // File-input chrome reset
        'file:border-0 file:bg-transparent file:text-sm file:font-medium',
        // Placeholder + ring offset
        'placeholder:text-muted-foreground ring-offset-background',
        className,
      )}
      style={{
        borderRadius: 'var(--rvui-radius-md, 10px)',
        transition:
          'border-color var(--rvui-duration-normal, 200ms) var(--rvui-ease, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow var(--rvui-duration-normal, 200ms) var(--rvui-ease, cubic-bezier(0.22, 1, 0.36, 1))',
      }}
      ref={ref}
      type={type}
      {...props}
    />
  );
}

export { Input };
