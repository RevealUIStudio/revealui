import type React from 'react';
import { cn } from '../utils/cn.js';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  ref?: React.Ref<HTMLInputElement>;
};

function Input({ type, className, ref, ...props }: InputProps) {
  return (
    <input
      className={cn(
        'flex h-10 w-full rounded border border-border bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
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
