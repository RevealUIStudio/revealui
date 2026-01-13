/**
 * Password Validation Utilities
 *
 * Password strength validation and requirements.
 */

export interface PasswordValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Validates password strength
 *
 * @param password - Password to validate
 * @returns Validation result with errors
 */
export function validatePasswordStrength(password: string): PasswordValidationResult {
  const errors: string[] = []

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long')
  }

  if (password.length > 128) {
    errors.push('Password must be less than 128 characters')
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number')
  }

  // Optional: special characters (not too strict)
  // if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
  //   errors.push('Password must contain at least one special character')
  // }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Checks if password meets minimum requirements (length only)
 * Used for less strict validation
 *
 * @param password - Password to check
 * @returns True if meets minimum requirements
 */
export function meetsMinimumPasswordRequirements(password: string): boolean {
  return password.length >= 8 && password.length <= 128
}
