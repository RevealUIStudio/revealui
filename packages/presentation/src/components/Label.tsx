import type React from 'react';
import { cn } from '../utils/cn.js';

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement> & {
  ref?: React.Ref<HTMLLabelElement>;
};

function Label({ className, ref, ...props }: LabelProps) {
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
  );
}

Label.displayName = 'Label';

export { Label };
