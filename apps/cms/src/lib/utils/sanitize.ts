/**
 * Input Sanitization Utilities
 *
 * Sanitizes user input to prevent XSS and injection attacks.
 */

/**
 * Sanitizes a string by removing potentially dangerous characters
 *
 * @param input - Input string to sanitize
 * @param maxLength - Maximum allowed length
 * @returns Sanitized string
 */
export function sanitizeString(input: string, maxLength: number = 255): string {
	if (typeof input !== "string") {
		return "";
	}

	// Trim whitespace
	let sanitized = input.trim();

	// Remove null bytes and control characters (except newlines and tabs)
	sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "");

	// Limit length
	if (sanitized.length > maxLength) {
		sanitized = sanitized.substring(0, maxLength);
	}

	return sanitized;
}

/**
 * Sanitizes a name field (user name, display name, etc.)
 *
 * @param name - Name to sanitize
 * @param maxLength - Maximum allowed length (default: 100)
 * @returns Sanitized name
 */
export function sanitizeName(name: string, maxLength: number = 100): string {
	let sanitized = sanitizeString(name, maxLength);

	// Remove HTML tags
	sanitized = sanitized.replace(/<[^>]*>/g, "");

	// Remove script tags and event handlers
	sanitized = sanitized.replace(/javascript:/gi, "");
	sanitized = sanitized.replace(/on\w+\s*=/gi, "");

	return sanitized;
}

/**
 * Validates and sanitizes email address
 *
 * @param email - Email to validate and sanitize
 * @returns Sanitized email or null if invalid
 */
export function sanitizeEmail(email: string): string | null {
	if (typeof email !== "string") {
		return null;
	}

	const sanitized = email.trim().toLowerCase();

	// Basic email validation
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	if (!emailRegex.test(sanitized)) {
		return null;
	}

	// Limit length
	if (sanitized.length > 254) {
		return null;
	}

	return sanitized;
}
