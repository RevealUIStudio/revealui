import type { ReactNode } from 'react';

const variantStyles = {
  default: 'bg-neutral-800 text-neutral-300',
  success: 'bg-green-900/40 text-green-400',
  warning: 'bg-yellow-900/40 text-yellow-400',
  error: 'bg-red-900/40 text-red-400',
  info: 'bg-blue-900/40 text-blue-400',
  brand: 'bg-orange-900/40 text-orange-400',
} as const;

const sizeStyles = {
  sm: 'px-1.5 py-0.5 text-[10px]',
  md: 'px-2 py-0.5 text-xs',
} as const;

export type BadgeVariant = keyof typeof variantStyles;
export type BadgeSize = keyof typeof sizeStyles;

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: ReactNode;
  className?: string;
}

export default function Badge({
  variant = 'default',
  size = 'md',
  children,
  className = '',
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </span>
  );
}
