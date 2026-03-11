import type React from 'react';
import { cn } from '../utils/cn.js';
import { Label, type LabelProps } from './Label.js';

export interface FormLabelProps extends LabelProps {
  required?: boolean;
  ref?: React.Ref<HTMLLabelElement>;
}

function FormLabel({ required, className, children, ref, ...props }: FormLabelProps) {
  return (
    <Label ref={ref} className={cn(className)} {...props}>
      {children}
      {required && <span className="text-destructive ml-1">*</span>}
    </Label>
  );
}

export { FormLabel };
