import React, { type Ref } from 'react';

export interface SlotProps extends React.HTMLAttributes<HTMLElement> {
  children?: React.ReactNode;
  asChild?: boolean;
  ref?: React.Ref<HTMLElement>;
}

/**
 * Slot component for polymorphic composition
 * Allows components to merge props with child elements
 */
function Slot({ children, asChild, ref, ...slotProps }: SlotProps) {
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      ...slotProps,
      ...(children.props as Record<string, unknown>),
      ref,
    } as unknown as React.HTMLAttributes<HTMLElement>);
  }

  return (
    <div {...slotProps} ref={ref as Ref<HTMLDivElement>}>
      {children}
    </div>
  );
}

export { Slot };
