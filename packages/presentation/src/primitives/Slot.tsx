import React, { type CSSProperties, type Ref } from 'react';

export interface SlotProps extends React.HTMLAttributes<HTMLElement> {
  children?: React.ReactNode;
  asChild?: boolean;
  ref?: React.Ref<HTMLElement>;
}

/**
 * Slot component for polymorphic composition
 * Clones the child element and merges parent props with the child's own props.
 * Parent className/style come first; child's are merged on top so authors can override.
 */
function Slot({ children, asChild: _asChild, ref, ...slotProps }: SlotProps) {
  if (React.isValidElement(children)) {
    const childProps = children.props as {
      className?: string;
      style?: CSSProperties;
      [key: string]: unknown;
    };
    const mergedClassName = [slotProps.className, childProps.className].filter(Boolean).join(' ');
    const mergedStyle: CSSProperties | undefined =
      slotProps.style || childProps.style
        ? { ...(slotProps.style ?? {}), ...(childProps.style ?? {}) }
        : undefined;

    return React.cloneElement(children, {
      ...slotProps,
      ...childProps,
      className: mergedClassName || undefined,
      style: mergedStyle,
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
