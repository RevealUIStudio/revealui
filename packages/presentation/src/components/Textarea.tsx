import type React from 'react';
import { cn } from '../utils/cn.js';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  ref?: React.Ref<HTMLTextAreaElement>;
};

function Textarea({ className, ref, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        // Layout + typography
        'flex min-h-[80px] w-full border bg-background px-3 py-2 text-sm',
        // Border — solid hex tokens (not alpha-translucent), matches Input primitive
        'border-input',
        // Hover affordance
        'hover:border-border-strong',
        // Focus — brand-tinted ring + border via --tenant-brand → --ring fallback chain
        'focus-visible:outline-none focus-visible:border-[var(--tenant-brand,var(--ring))] focus-visible:ring-2 focus-visible:ring-[var(--tenant-brand,var(--ring))] focus-visible:ring-offset-2',
        // Error state — solid red border + ring on aria-invalid
        'aria-invalid:border-destructive aria-invalid:focus-visible:border-destructive aria-invalid:focus-visible:ring-destructive',
        // Disabled state
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-input',
        // Read-only state
        'read-only:bg-surface-2 read-only:cursor-default read-only:hover:border-input',
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
      {...props}
    />
  );
}

export { Textarea };
