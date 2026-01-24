import React from 'react'
import { cn } from '../utils/cn'

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(({ className, ...props }, ref) => {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: label associations are provided by consumers.
    <label
      ref={ref}
      className={cn(
        'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        className,
      )}
      {...props}
    />
  )
})
Label.displayName = 'Label'

export { Label }
