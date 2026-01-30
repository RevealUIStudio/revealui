import React from 'react'
import { cn } from '../utils/cn.js'

export interface BoxProps extends React.HTMLAttributes<HTMLElement> {
  as?: 'div' | 'span' | 'section' | 'article' | 'header' | 'footer' | 'main' | 'aside' | 'nav'
}

/**
 * Box primitive - Basic container component
 */
export const Box = React.forwardRef<HTMLElement, BoxProps>(
  ({ as: Component = 'div', className, ...props }, ref) => {
    return <Component ref={ref as React.Ref<any>} className={cn(className)} {...props} />
  },
)

Box.displayName = 'Box'
