/**
 * Utility function for conditionally joining classNames together
 * Similar to clsx/classnames but simpler for Tailwind CSS usage
 */
type ClassValue =
	| string
	| number
	| boolean
	| undefined
	| null
	| { [key: string]: boolean };

export function cn(...inputs: ClassValue[]): string {
	return inputs.flat().filter(Boolean).join(" ").trim();
}
