import type { ReactNode } from 'react';

const variantStyles = {
  default: 'bg-neutral-900 border border-neutral-800 rounded-lg',
  elevated: 'bg-neutral-900 border border-neutral-700 rounded-lg shadow-lg',
  ghost: 'bg-transparent border border-neutral-800/50 rounded-lg',
} as const;

const paddingStyles = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
} as const;

export type CardVariant = keyof typeof variantStyles;
export type CardPadding = keyof typeof paddingStyles;

interface CardProps {
  variant?: CardVariant;
  padding?: CardPadding;
  header?: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function Card({
  variant = 'default',
  padding = 'md',
  header,
  children,
  className = '',
}: CardProps) {
  return (
    <div className={`${variantStyles[variant]} ${paddingStyles[padding]} ${className}`}>
      {header && <div className="mb-3 border-b border-neutral-800 pb-3">{header}</div>}
      {children}
    </div>
  );
}
