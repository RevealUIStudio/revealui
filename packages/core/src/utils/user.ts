/**
 * User Utility Functions
 *
 * Utilities for user data formatting and manipulation.
 */

/**
 * Format a user's full name from first and last name components.
 *
 * @param firstName - The user's first name
 * @param lastName - The user's last name
 * @returns Formatted full name string
 */
export function formatUserName(firstName: string, lastName: string): string {
	return `${firstName} ${lastName}`;
}
