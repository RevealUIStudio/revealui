/**
 * Magic Links Schema Tests
 *
 * Validates the magic_links table definition exports the expected columns
 * and type aliases.
 */

import { describe, expect, it } from 'vitest';
import type { MagicLink, NewMagicLink } from '../magic-links.js';
import { magicLinks } from '../magic-links.js';

describe('magicLinks schema', () => {
  it('exports the magicLinks table', () => {
    expect(magicLinks).toBeDefined();
  });

  it('has all required columns', () => {
    expect(magicLinks.id).toBeDefined();
    expect(magicLinks.userId).toBeDefined();
    expect(magicLinks.tokenHash).toBeDefined();
    expect(magicLinks.tokenSalt).toBeDefined();
    expect(magicLinks.expiresAt).toBeDefined();
    expect(magicLinks.usedAt).toBeDefined();
    expect(magicLinks.createdAt).toBeDefined();
  });

  it('maps to the correct SQL table name', () => {
    // biome-ignore lint/suspicious/noExplicitAny: accessing internal Drizzle symbol for test verification
    const tableName = (magicLinks as any)[Symbol.for('drizzle:Name')];
    expect(tableName).toBe('magic_links');
  });

  it('exports MagicLink and NewMagicLink types', () => {
    // Type-level check  -  if this compiles, the types are exported correctly
    const _select: MagicLink | undefined = undefined;
    const _insert: NewMagicLink | undefined = undefined;
    expect(_select).toBeUndefined();
    expect(_insert).toBeUndefined();
  });
});
