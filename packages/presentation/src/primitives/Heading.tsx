import type React from 'react'
import { cn } from '../utils/cn.js'

export interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  size?: 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl'
  ref?: React.Ref<HTMLHeadingElement>
}

/**
 * Heading primitive - Heading component
 */
function Heading({ as, size = 'base', className, children, ref, ...props }: HeadingProps) {
  const Component = as || 'h2'

  const headingClasses = cn(
    size === 'sm' && 'text-sm',
    size === 'base' && 'text-base',
    size === 'lg' && 'text-lg',
    size === 'xl' && 'text-xl',
    size === '2xl' && 'text-2xl',
    size === '3xl' && 'text-3xl',
    size === '4xl' && 'text-4xl',
    'font-semibold',
    className,
  )

  return (
    <Component ref={ref} className={headingClasses} {...props}>
      {children}
    </Component>
  )
}

export { Heading }
