/**
 * Password Validation Utilities
 *
 * Password strength validation and requirements.
 */

/** Check if any character in the string falls within the given char code range (inclusive) */
function hasCharInRange(str: string, low: number, high: number): boolean {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= low && code <= high) return true;
  }
  return false;
}

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates password strength
 *
 * @param password - Password to validate
 * @returns Validation result with errors
 */
export function validatePasswordStrength(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (password.length > 128) {
    errors.push('Password must be less than 128 characters');
  }

  if (!hasCharInRange(password, 97, 122)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!hasCharInRange(password, 65, 90)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!hasCharInRange(password, 48, 57)) {
    errors.push('Password must contain at least one number');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Checks if password meets minimum requirements (length only)
 * Used for less strict validation
 *
 * @param password - Password to check
 * @returns True if meets minimum requirements
 */
export function meetsMinimumPasswordRequirements(password: string): boolean {
  return password.length >= 8 && password.length <= 128;
}
