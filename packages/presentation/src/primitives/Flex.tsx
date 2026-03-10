import type React from 'react'
import { cn } from '../utils/cn.js'

export interface FlexProps extends React.HTMLAttributes<HTMLDivElement> {
  direction?: 'row' | 'column' | 'row-reverse' | 'column-reverse'
  align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline'
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'
  wrap?: boolean | 'wrap' | 'nowrap' | 'wrap-reverse'
  gap?: number | string
  ref?: React.Ref<HTMLDivElement>
}

/**
 * Flex primitive - Flexbox container component
 */
function Flex({
  direction = 'row',
  align,
  justify,
  wrap,
  gap,
  className,
  style,
  ref,
  ...props
}: FlexProps) {
  const flexClasses = cn(
    'flex',
    direction && `flex-${direction}`,
    align && `items-${align === 'start' ? 'start' : align === 'end' ? 'end' : align}`,
    justify &&
      `justify-${justify === 'start' ? 'start' : justify === 'end' ? 'end' : justify === 'between' ? 'between' : justify === 'around' ? 'around' : justify === 'evenly' ? 'evenly' : 'center'}`,
    wrap === true && 'flex-wrap',
    wrap === 'wrap' && 'flex-wrap',
    wrap === 'nowrap' && 'flex-nowrap',
    wrap === 'wrap-reverse' && 'flex-wrap-reverse',
    className,
  )

  const flexStyle = {
    ...style,
    ...(gap && { gap: typeof gap === 'number' ? `${gap}px` : gap }),
  }

  return <div ref={ref} className={flexClasses} style={flexStyle} {...props} />
}

export { Flex }
