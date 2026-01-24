import React from "react";
import { cn } from "../utils/cn";

export interface FlexProps extends React.HTMLAttributes<HTMLDivElement> {
	direction?: "row" | "column" | "row-reverse" | "column-reverse";
	align?: "start" | "center" | "end" | "stretch" | "baseline";
	justify?: "start" | "center" | "end" | "between" | "around" | "evenly";
	wrap?: boolean | "wrap" | "nowrap" | "wrap-reverse";
	gap?: number | string;
}

/**
 * Flex primitive - Flexbox container component
 */
export const Flex = React.forwardRef<HTMLDivElement, FlexProps>(
	(
		{
			direction = "row",
			align,
			justify,
			wrap,
			gap,
			className,
			style,
			...props
		},
		ref,
	) => {
		const flexClasses = cn(
			"flex",
			direction && `flex-${direction}`,
			align &&
				`items-${align === "start" ? "start" : align === "end" ? "end" : align}`,
			justify &&
				`justify-${justify === "start" ? "start" : justify === "end" ? "end" : justify === "between" ? "between" : justify === "around" ? "around" : justify === "evenly" ? "evenly" : "center"}`,
			wrap === true && "flex-wrap",
			wrap === "wrap" && "flex-wrap",
			wrap === "nowrap" && "flex-nowrap",
			wrap === "wrap-reverse" && "flex-wrap-reverse",
			className,
		);

		const flexStyle = {
			...style,
			...(gap && { gap: typeof gap === "number" ? `${gap}px` : gap }),
		};

		return (
			<div ref={ref} className={flexClasses} style={flexStyle} {...props} />
		);
	},
);

Flex.displayName = "Flex";
