import { cn, InputCVA } from '@revealui/presentation';
import type { ComponentProps, ReactNode } from 'react';
import { Button } from './button';

export function EmailSignupForm({
  label = 'Email address',
  placeholder = 'Enter your email',
  cta,
  variant = 'normal',
  className,
  ...props
}: {
  label?: string;
  placeholder?: string;
  cta: ReactNode;
  variant?: 'normal' | 'overlay';
} & ComponentProps<'form'>) {
  return (
    <form
      className={cn(
        'flex rounded-full p-1 inset-ring-1 dark:bg-white/10 dark:inset-ring-white/10',
        variant === 'normal' && 'bg-white inset-ring-black/10',
        variant === 'overlay' && 'bg-white/15 inset-ring-white/10',
        className,
      )}
      {...props}
    >
      <InputCVA
        className={cn(
          'h-auto min-w-0 flex-1 border-0 bg-transparent px-3 text-sm/7 shadow-none ring-0 focus-visible:border-0 focus-visible:ring-0 dark:text-white',
          variant === 'normal' && 'text-mist-950',
          variant === 'overlay' && 'text-white placeholder:text-white/60',
        )}
        type="email"
        aria-label={label}
        placeholder={placeholder}
      />
      <Button color={variant === 'normal' ? 'dark/light' : 'light'} type="submit">
        {cta}
      </Button>
    </form>
  );
}
