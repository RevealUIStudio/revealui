import type React from 'react';
import type { Ref } from 'react';

interface SlotProps extends React.HTMLAttributes<HTMLElement> {
  children?: React.ReactNode;
  ref?: React.Ref<HTMLElement>;
}

function Slot({ children, ref, ...slotProps }: SlotProps) {
  return (
    <div {...slotProps} ref={ref as Ref<HTMLDivElement>}>
      {children}
    </div>
  );
}

export type { SlotProps };
export { Slot };
