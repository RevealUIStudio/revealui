"use client";

import { cva, type VariantProps } from "class-variance-authority";
import React from "react";
import { cn } from "@/lib/styles/classnames";

const labelVariants = cva(
	"text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
);

const FormLabel = React.forwardRef<
	HTMLLabelElement, // Specify the type for the ref
	React.ComponentPropsWithoutRef<"label"> & // Extend from standard HTMLLabelElement props
		VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
	<FormLabel className={cn(labelVariants(), className)} ref={ref} {...props} />
));
FormLabel.displayName = "FormLabel";

export { FormLabel };
