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
  if (typeof input !== 'string') {
    return '';
  }

  const stripControlChars = (value: string): string => {
    let result = '';
    for (let i = 0; i < value.length; i++) {
      const code = value.charCodeAt(i);
      if (code === 0x09 || code === 0x0a || code === 0x0d) {
        result += value[i];
        continue;
      }
      if (code <= 0x1f || code === 0x7f) {
        continue;
      }
      result += value[i];
    }
    return result;
  };

  // Trim whitespace
  let sanitized = input.trim();

  // Remove null bytes and control characters (except newlines and tabs)
  sanitized = stripControlChars(sanitized);

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
  sanitized = sanitized.replace(/<[^>]*>/g, '');

  // Remove script tags and event handlers
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');

  return sanitized;
}

/**
 * Validates and sanitizes email address
 *
 * @param email - Email to validate and sanitize
 * @returns Sanitized email or null if invalid
 */
export function sanitizeEmail(email: string): string | null {
  if (typeof email !== 'string') {
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
