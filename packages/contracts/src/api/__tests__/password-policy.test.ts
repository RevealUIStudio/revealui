/**
 * The sign-up checklist must accept a password only when both server gates do:
 * the sign-up contract (minimum 12) and the strength validator (classes + max).
 * The strength floor stays at 8 so password reset is not tightened here.
 */

import { describe, expect, it } from 'vitest';
import { SignUpRequestSchema, signupPasswordChecklist } from '../auth.js';
import { validatePasswordStrength } from '../password-policy.js';

function serverAcceptsSignupPassword(password: string): boolean {
  const contract = SignUpRequestSchema.safeParse({
    email: 'user@example.com',
    password,
    name: 'Ada Lovelace',
    tosAccepted: true,
  });
  return contract.success && validatePasswordStrength(password).valid;
}

const SAMPLES = [
  '',
  'a',
  'Abcdefg1',
  'short',
  'password1234',
  'PASSWORD1234',
  'Passwordabcd',
  'Password1234',
  `A1${'a'.repeat(126)}`,
  `A1${'a'.repeat(127)}`,
];

describe('signupPasswordChecklist', () => {
  it('matches the sign-up contract and the strength validator together', () => {
    for (const password of SAMPLES) {
      const ready = signupPasswordChecklist(password).every((item) => item.met);
      expect(ready).toBe(serverAcceptsSignupPassword(password));
    }
  });

  it('keeps the sign-up minimum at 12 when an 8 character password passes strength', () => {
    const password = 'Abcdefg1';
    expect(password.length).toBe(8);
    expect(validatePasswordStrength(password).valid).toBe(true);
    const length = signupPasswordChecklist(password).find((item) => item.id === 'minLength');
    expect(length?.met).toBe(false);
    expect(length?.label).toContain('12');
    expect(
      signupPasswordChecklist(password).some((item) => item.label.includes('at least 8')),
    ).toBe(false);
  });

  it('uses the strength validator text for letter and number rules', () => {
    const labels = signupPasswordChecklist('').map((item) => item.label);
    expect(labels).toContain('Password must contain at least one uppercase letter');
    expect(labels).toContain('Password must contain at least one lowercase letter');
    expect(labels).toContain('Password must contain at least one number');
    expect(labels).toContain('Password must be less than 128 characters');
  });
});
