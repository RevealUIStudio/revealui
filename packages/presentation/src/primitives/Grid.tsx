import React from "react";
import { cn } from "../utils/cn";

export interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
	cols?: number | string;
	rows?: number | string;
	gap?: number | string;
}

/**
 * Grid primitive - CSS Grid container component
 */
export const Grid = React.forwardRef<HTMLDivElement, GridProps>(
	({ cols, rows, gap, className, style, ...props }, ref) => {
		const gridStyle: React.CSSProperties = {
			...style,
			...(cols && {
				gridTemplateColumns:
					typeof cols === "number" ? `repeat(${cols}, 1fr)` : cols,
			}),
			...(rows && {
				gridTemplateRows:
					typeof rows === "number" ? `repeat(${rows}, 1fr)` : rows,
			}),
			...(gap && { gap: typeof gap === "number" ? `${gap}px` : gap }),
		};

		return (
			<div
				ref={ref}
				className={cn("grid", className)}
				style={gridStyle}
				{...props}
			/>
		);
	},
);

Grid.displayName = "Grid";
