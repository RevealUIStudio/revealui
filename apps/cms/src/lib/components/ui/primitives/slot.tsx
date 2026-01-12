import React, { type Ref } from 'react'

interface SlotProps extends React.HTMLAttributes<HTMLElement> {
  children?: React.ReactNode
}
const Slot = React.forwardRef<HTMLElement, SlotProps>((props, forwardedRef) => {
  const { children, ...slotProps } = props

  return (
    <div {...slotProps} ref={forwardedRef as Ref<HTMLDivElement>}>
      {children}
    </div>
  )
})
Slot.displayName = 'Slot'
export { Slot }
export type { SlotProps }
// import * as React from "react";

// interface SlotProps extends React.HTMLAttributes<HTMLElement> {
//   children?: React.ReactNode;
// }

// const Slot = React.forwardRef<HTMLElement, SlotProps>((props, forwardedRef) => {
//   const { children, ...slotProps } = props;
//   return (
//     <div {...slotProps} ref={forwardedRef}>
//       {children}
//     </div>
//   );
// });

// Slot.displayName = "Slot";

// export { Slot };
// export type { SlotProps };
