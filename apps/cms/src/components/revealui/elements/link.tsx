import Link from 'next/link';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils/cn';

export function RevealUILink({
  href,
  className,
  ...props
}: {
  href: string;
} & Omit<ComponentProps<typeof Link>, 'href'>) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center gap-2 text-sm/7 font-medium text-mist-950 dark:text-white',
        className,
      )}
      {...props}
    />
  );
}
