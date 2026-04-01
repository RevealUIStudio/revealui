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

  // Remove HTML tags without regex — walk the string and strip < ... > sequences
  sanitized = stripHtmlTags(sanitized);

  // Remove dangerous URI schemes and event handler patterns
  // Case-insensitive removal of javascript: scheme
  let idx = sanitized.toLowerCase().indexOf('javascript:');
  while (idx !== -1) {
    sanitized = sanitized.slice(0, idx) + sanitized.slice(idx + 11);
    idx = sanitized.toLowerCase().indexOf('javascript:');
  }

  // Strip inline event handlers (onclick=, onerror=, onload=, etc.)
  sanitized = stripEventHandlers(sanitized);

  return sanitized;
}

/** Check if a character code is a lowercase ASCII letter (a-z) */
function isLowerAlpha(code: number): boolean {
  return code >= 97 && code <= 122;
}

/**
 * Strip inline event handler attributes (onclick=, onerror=, onload=, etc.)
 * Matches "on" followed by one or more letters followed by "=" (case-insensitive)
 */
function stripEventHandlers(input: string): string {
  let result = '';
  let i = 0;
  while (i < input.length) {
    // Check for "on" prefix (case-insensitive)
    if (
      i + 2 < input.length &&
      (input[i] === 'o' || input[i] === 'O') &&
      (input[i + 1] === 'n' || input[i + 1] === 'N')
    ) {
      // Check if followed by letters then '='
      let j = i + 2;
      while (j < input.length && isLowerAlpha(input.charCodeAt(j) | 0x20)) {
        j++;
      }
      if (j > i + 2 && j < input.length && input[j] === '=') {
        // Skip "onclick=" (from i to j inclusive)
        i = j + 1;
        continue;
      }
    }
    result += input[i];
    i++;
  }
  return result;
}

/** Strip HTML tags by walking the string character by character */
function stripHtmlTags(input: string): string {
  let result = '';
  let inTag = false;
  for (const ch of input) {
    if (ch === '<') {
      inTag = true;
      continue;
    }
    if (ch === '>') {
      inTag = false;
      continue;
    }
    if (!inTag) {
      result += ch;
    }
  }
  return result;
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

  // Length check
  if (sanitized.length > 254 || sanitized.length < 3) {
    return null;
  }

  // Structural email validation without regex
  const atIndex = sanitized.indexOf('@');
  if (atIndex < 1) return null;
  if (sanitized.indexOf('@', atIndex + 1) !== -1) return null;
  const local = sanitized.slice(0, atIndex);
  const domain = sanitized.slice(atIndex + 1);
  if (!(local && domain)) return null;
  if (!domain.includes('.')) return null;
  if (domain.startsWith('.') || domain.endsWith('.')) return null;
  if (sanitized.includes(' ')) return null;

  return sanitized;
}
