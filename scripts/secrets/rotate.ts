#!/usr/bin/env tsx

/**
 * Secret Rotation Helper
 *
 * Prints a rotation checklist for the given secret name and generates a new value.
 *
 * Usage:
 *   pnpm secrets:rotate CMS_ADMIN_PASSWORD
 *   pnpm secrets:rotate STRIPE_SECRET_KEY
 */

import { randomInt } from 'node:crypto';

const PASSWORD_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';

function generatePassword(length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += PASSWORD_CHARS[randomInt(PASSWORD_CHARS.length)];
  }
  return result;
}

const secretName = process.argv[2];

if (!secretName) {
  console.error('Usage: pnpm secrets:rotate <SECRET_NAME>');
  console.error('Example: pnpm secrets:rotate CMS_ADMIN_PASSWORD');
  process.exit(1);
}

const newValue = generatePassword(24);

console.log(`\n🔄 Rotation checklist for ${secretName}\n`);
console.log(`New value: ${newValue}\n`);
console.log('Steps:');
console.log('  1. Update the secret in its primary location (CMS, service dashboard, etc.)');
console.log('  2. Update .env.development.local (or RevVault entry)');
console.log('  3. Update any CI/CD secrets (GitHub Actions, Vercel, etc.)');
console.log('  4. Rotate in any dependent services that use this credential');
console.log('  5. Verify the new value works before discarding the old one');
console.log('  6. Run pnpm secrets:scan to confirm no hardcoded copies remain\n');
