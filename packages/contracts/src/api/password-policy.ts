/**
 * Password rules shared by the sign-up contract and the strength check.
 *
 * Sign-up requires a longer minimum than the general strength check.
 * Do not lower SIGNUP_PASSWORD_MIN_LENGTH to the strength floor.
 * signupPasswordChecklist (in auth.ts) reads the sign-up schema for length
 * and these strength rules for everything else, so the form cannot drift.
 */

export const PASSWORD_STRENGTH_MIN_LENGTH = 8;
export const PASSWORD_STRENGTH_MAX_LENGTH = 128;

export const SIGNUP_PASSWORD_MIN_LENGTH = 12;
export const SIGNUP_PASSWORD_MIN_MESSAGE = `Password must be at least ${SIGNUP_PASSWORD_MIN_LENGTH} characters long`;

export type PasswordChecklistId = 'minLength' | 'maxLength' | 'lowercase' | 'uppercase' | 'number';

export interface PasswordChecklistItem {
  id: PasswordChecklistId;
  label: string;
  met: boolean;
}

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

interface PasswordStrengthRule {
  id: PasswordChecklistId;
  message: string;
  met: (password: string) => boolean;
}

/** Inclusive char-code range. Avoids regular expressions for letter and digit checks. */
function hasCharInRange(value: string, low: number, high: number): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= low && code <= high) return true;
  }
  return false;
}

const STRENGTH_RULES: readonly PasswordStrengthRule[] = [
  {
    id: 'minLength',
    message: `Password must be at least ${PASSWORD_STRENGTH_MIN_LENGTH} characters long`,
    met: (password) => password.length >= PASSWORD_STRENGTH_MIN_LENGTH,
  },
  {
    id: 'maxLength',
    message: 'Password must be less than 128 characters',
    met: (password) => password.length <= PASSWORD_STRENGTH_MAX_LENGTH,
  },
  {
    id: 'lowercase',
    message: 'Password must contain at least one lowercase letter',
    met: (password) => hasCharInRange(password, 97, 122),
  },
  {
    id: 'uppercase',
    message: 'Password must contain at least one uppercase letter',
    met: (password) => hasCharInRange(password, 65, 90),
  },
  {
    id: 'number',
    message: 'Password must contain at least one number',
    met: (password) => hasCharInRange(password, 48, 57),
  },
];

export function passwordStrengthChecklist(password: string): PasswordChecklistItem[] {
  return STRENGTH_RULES.map((rule) => ({
    id: rule.id,
    label: rule.message,
    met: rule.met(password),
  }));
}

/**
 * General strength check used by account creation and password reset.
 * The minimum stays 8. Sign-up adds a stricter length rule in the contract.
 */
export function validatePasswordStrength(password: string): PasswordValidationResult {
  const errors: string[] = [];
  for (const rule of STRENGTH_RULES) {
    if (!rule.met(password)) errors.push(rule.message);
  }
  return { valid: errors.length === 0, errors };
}
