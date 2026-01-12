import * as React from 'react'
import { Primitive } from '.' // Adjust import according to your structure

const NAME = 'Label'

type LabelElement = React.ComponentRef<typeof Primitive.label>
type LabelProps = React.ComponentPropsWithoutRef<typeof Primitive.label>

const Label = React.forwardRef<LabelElement, LabelProps>((props, forwardedRef) => {
  return (
    <Primitive.label
      {...props}
      ref={forwardedRef}
      onMouseDown={(event) => {
        const target = event.target as HTMLElement
        if (target.closest('button, input, select, textarea')) return

        props.onMouseDown?.(event)
        if (!event.defaultPrevented && event.detail > 1) event.preventDefault()
      }}
    />
  )
})

Label.displayName = NAME

export { Label }
export type { LabelProps }
