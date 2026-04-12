/**
 * Passkeys Schema Tests
 *
 * Validates the passkeys table definition exports the expected columns
 * and type aliases.
 */

import { describe, expect, it } from 'vitest';
import type { NewPasskey, Passkey } from '../passkeys.js';
import { passkeys } from '../passkeys.js';

describe('passkeys schema', () => {
  it('exports the passkeys table', () => {
    expect(passkeys).toBeDefined();
  });

  it('has all required columns', () => {
    expect(passkeys.id).toBeDefined();
    expect(passkeys.userId).toBeDefined();
    expect(passkeys.credentialId).toBeDefined();
    expect(passkeys.publicKey).toBeDefined();
    expect(passkeys.counter).toBeDefined();
    expect(passkeys.transports).toBeDefined();
    expect(passkeys.aaguid).toBeDefined();
    expect(passkeys.deviceName).toBeDefined();
    expect(passkeys.backedUp).toBeDefined();
    expect(passkeys.createdAt).toBeDefined();
    expect(passkeys.lastUsedAt).toBeDefined();
  });

  it('maps to the correct SQL table name', () => {
    // biome-ignore lint/suspicious/noExplicitAny: accessing internal Drizzle symbol for test verification
    const tableName = (passkeys as any)[Symbol.for('drizzle:Name')];
    expect(tableName).toBe('passkeys');
  });

  it('exports Passkey and NewPasskey types', () => {
    // Type-level check  -  if this compiles, the types are exported correctly
    const _select: Passkey | undefined = undefined;
    const _insert: NewPasskey | undefined = undefined;
    expect(_select).toBeUndefined();
    expect(_insert).toBeUndefined();
  });
});
