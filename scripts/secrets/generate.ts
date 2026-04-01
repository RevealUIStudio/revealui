#!/usr/bin/env tsx

/**
 * Secret Generator
 *
 * Generates a strong random password or secret and prints it to stdout.
 *
 * Usage:
 *   pnpm secrets:generate             # 24-char password (default)
 *   pnpm secrets:generate --hex       # 32-byte hex secret
 *   pnpm secrets:generate --length=32 # custom length
 */

import { randomBytes, randomInt } from 'node:crypto';

const PASSWORD_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';

function generatePassword(length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += PASSWORD_CHARS[randomInt(PASSWORD_CHARS.length)];
  }
  return result;
}

function generateHexSecret(bytes: number): string {
  return randomBytes(bytes).toString('hex');
}

function parseArgs(): { hex: boolean; length: number } {
  const args = process.argv.slice(2);
  const hex = args.includes('--hex');
  const lengthArg = args.find((a) => a.startsWith('--length='));
  const length = lengthArg ? Number.parseInt(lengthArg.split('=')[1], 10) : 24;
  return { hex, length: Number.isNaN(length) ? 24 : length };
}

const { hex, length } = parseArgs();
const secret = hex ? generateHexSecret(length) : generatePassword(length);
console.log(secret);
