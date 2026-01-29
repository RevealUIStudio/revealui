import React from 'react'
import { cn } from '../utils/cn.js'

export interface TextProps extends React.HTMLAttributes<HTMLParagraphElement> {
  as?: 'p' | 'span' | 'div'
  size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl'
  weight?: 'normal' | 'medium' | 'semibold' | 'bold'
  color?: 'default' | 'muted' | 'primary' | 'secondary' | 'destructive'
}

/**
 * Text primitive - Typography component
 */
export const Text = React.forwardRef<HTMLParagraphElement, TextProps>(
  (
    {
      as: Component = 'p',
      size = 'base',
      weight = 'normal',
      color = 'default',
      className,
      ...props
    },
    ref,
  ) => {
    const textClasses = cn(
      size === 'xs' && 'text-xs',
      size === 'sm' && 'text-sm',
      size === 'base' && 'text-base',
      size === 'lg' && 'text-lg',
      size === 'xl' && 'text-xl',
      size === '2xl' && 'text-2xl',
      weight === 'normal' && 'font-normal',
      weight === 'medium' && 'font-medium',
      weight === 'semibold' && 'font-semibold',
      weight === 'bold' && 'font-bold',
      color === 'muted' && 'text-muted-foreground',
      color === 'primary' && 'text-primary',
      color === 'secondary' && 'text-secondary-foreground',
      color === 'destructive' && 'text-destructive',
      className,
    )

    return <Component ref={ref} className={textClasses} {...props} />
  },
)

Text.displayName = 'Text'
