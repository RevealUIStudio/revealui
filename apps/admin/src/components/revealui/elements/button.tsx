import { Button as PresentationButton, cn } from '@revealui/presentation';
import Link from 'next/link';
import type { ComponentProps } from 'react';

const sizes = {
  md: 'px-3 py-1',
  lg: 'px-4 py-2',
};

const solidColor = {
  'dark/light':
    'bg-mist-950 text-white hover:bg-mist-800 dark:bg-mist-300 dark:text-mist-950 dark:hover:bg-mist-200',
  light: 'hover bg-white text-mist-950 hover:bg-mist-100 dark:bg-mist-100 dark:hover:bg-white',
} as const;

const plainColor = {
  'dark/light': 'text-mist-950 hover:bg-mist-950/10 dark:text-white dark:hover:bg-white/10',
  light: 'text-white hover:bg-white/15 dark:hover:bg-white/10',
} as const;

type KitColor = keyof typeof solidColor;
type KitSize = keyof typeof sizes;

export function Button({
  size = 'md',
  type = 'button',
  color = 'dark/light',
  className,
  ...props
}: {
  size?: KitSize;
  color?: KitColor;
} & Omit<ComponentProps<typeof PresentationButton>, 'size' | 'color' | 'variant' | 'appearance'>) {
  return (
    <PresentationButton
      type={type}
      appearance="ghost"
      variant="neutral"
      size="clear"
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-1 rounded-full text-sm/7 font-medium',
        solidColor[color],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}

export function ButtonLink({
  size = 'md',
  color = 'dark/light',
  className,
  href,
  ...props
}: {
  href: string;
  size?: KitSize;
  color?: KitColor;
} & Omit<ComponentProps<typeof Link>, 'href'>) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-1 rounded-full text-sm/7 font-medium',
        solidColor[color],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}

export function SoftButton({
  size = 'md',
  type = 'button',
  className,
  ...props
}: {
  size?: KitSize;
} & Omit<ComponentProps<typeof PresentationButton>, 'size' | 'variant' | 'appearance'>) {
  return (
    <PresentationButton
      type={type}
      appearance="ghost"
      variant="neutral"
      size="clear"
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-1 rounded-full bg-mist-950/10 text-sm/7 font-medium text-mist-950 hover:bg-mist-950/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/20',
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}

export function SoftButtonLink({
  size = 'md',
  href,
  className,
  ...props
}: {
  href: string;
  size?: KitSize;
} & Omit<ComponentProps<typeof Link>, 'href'>) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-1 rounded-full bg-mist-950/10 text-sm/7 font-medium text-mist-950 hover:bg-mist-950/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/20',
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}

export function PlainButton({
  size = 'md',
  color = 'dark/light',
  type = 'button',
  className,
  ...props
}: {
  size?: KitSize;
  color?: KitColor;
} & Omit<ComponentProps<typeof PresentationButton>, 'size' | 'color' | 'variant' | 'appearance'>) {
  return (
    <PresentationButton
      type={type}
      appearance="ghost"
      variant="neutral"
      size="clear"
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-full text-sm/7 font-medium',
        plainColor[color],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}

export function PlainButtonLink({
  size = 'md',
  color = 'dark/light',
  href,
  className,
  ...props
}: {
  href: string;
  size?: KitSize;
  color?: KitColor;
} & Omit<ComponentProps<typeof Link>, 'href'>) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-full text-sm/7 font-medium',
        plainColor[color],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
