import React, { type Ref } from "react";

export interface SlotProps extends React.HTMLAttributes<HTMLElement> {
	children?: React.ReactNode;
	asChild?: boolean;
}

/**
 * Slot component for polymorphic composition
 * Allows components to merge props with child elements
 */
export const Slot = React.forwardRef<HTMLElement, SlotProps>(
	(props, forwardedRef) => {
		const { children, asChild, ...slotProps } = props;

		if (asChild && React.isValidElement(children)) {
			return React.cloneElement(children, {
				...slotProps,
				...(children.props as Record<string, unknown>),
				ref: forwardedRef,
			} as unknown as React.HTMLAttributes<HTMLElement>);
		}

		return (
			<div {...slotProps} ref={forwardedRef as Ref<HTMLDivElement>}>
				{children}
			</div>
		);
	},
);

Slot.displayName = "Slot";
