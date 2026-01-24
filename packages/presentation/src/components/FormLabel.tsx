import React from 'react'
import { cn } from '../utils/cn'
import { Label, type LabelProps } from './Label'

export interface FormLabelProps extends LabelProps {
  required?: boolean
}

const FormLabel = React.forwardRef<HTMLLabelElement, FormLabelProps>(
  ({ required, className, children, ...props }, ref) => {
    return (
      <Label ref={ref} className={cn(className)} {...props}>
        {children}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
    )
  },
)
FormLabel.displayName = 'FormLabel'

export { FormLabel }
