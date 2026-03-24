import type * as React from 'react';
import { Primitive } from '.'; // Adjust import according to your structure

type LabelElement = HTMLLabelElement;
type LabelProps = React.ComponentPropsWithoutRef<'label'>;

function Label({ ref, ...props }: LabelProps & { ref?: React.Ref<LabelElement> }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: label is associated by consumers via htmlFor or nesting.
    <Primitive.label
      {...props}
      ref={ref}
      onMouseDown={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest('button, input, select, textarea')) return;

        props.onMouseDown?.(event);
        if (!event.defaultPrevented && event.detail > 1) event.preventDefault();
      }}
    />
  );
}

export type { LabelProps };
export { Label };
