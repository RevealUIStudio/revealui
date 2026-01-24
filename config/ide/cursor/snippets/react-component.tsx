/**
 * React Component Template
 *
 * Usage: Create components in apps/cms/src/lib/components/
 */

import type React from "react";

interface ComponentNameProps {
	title: string;
	description?: string;
	children?: React.ReactNode;
}

/**
 * Component description
 *
 * @param props - Component props
 * @returns JSX element
 */
export const ComponentName: React.FC<ComponentNameProps> = ({
	title,
	description,
	children,
}) => {
	return (
		<div className="container mx-auto p-4">
			<h1 className="text-2xl font-bold">{title}</h1>
			{description && <p className="text-gray-600">{description}</p>}
			{children && <div>{children}</div>}
		</div>
	);
};
