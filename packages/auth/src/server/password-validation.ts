/**
 * Password Validation Utilities
 *
 * Strength checks live in `@revealui/contracts/api/password-policy` so the
 * sign-up checklist and this server gate share one implementation.
 */

import {
  PASSWORD_STRENGTH_MAX_LENGTH,
  PASSWORD_STRENGTH_MIN_LENGTH,
  type PasswordValidationResult,
  validatePasswordStrength,
} from '@revealui/contracts/api/password-policy';

export type { PasswordValidationResult };
export { validatePasswordStrength };

/**
 * Checks if password meets minimum requirements (length only)
 * Used for less strict validation
 *
 * @param password - Password to check
 * @returns True if meets minimum requirements
 */
export function meetsMinimumPasswordRequirements(password: string): boolean {
  return (
    password.length >= PASSWORD_STRENGTH_MIN_LENGTH &&
    password.length <= PASSWORD_STRENGTH_MAX_LENGTH
  );
}

/**
 * Check if a password appears in known data breaches via the
 * HaveIBeenPwned Passwords API (k-anonymity model).
 *
 * Only the first 5 characters of the SHA-1 hash are sent to the API.
 * The full hash never leaves the server.
 *
 * @returns The number of times this password has been seen in breaches, or 0 if clean.
 *          Returns -1 if the check could not be performed (network error).
 */
export async function checkPasswordBreach(password: string): Promise<number> {
  const { createHash } = await import('node:crypto');
  // lgtm[js/insufficient-password-hash] - SHA-1 required by HIBP k-anonymity API, not used for password storage
  const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  try {
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return -1;

    const text = await response.text();
    for (const line of text.split('\n')) {
      const [hashSuffix, countStr] = line.split(':');
      if (hashSuffix?.trim() === suffix) {
        return Number.parseInt(countStr?.trim() ?? '0', 10);
      }
    }
    return 0;
  } catch {
    // Network error, timeout, or API issue  -  don't block the user
    return -1;
  }
}
