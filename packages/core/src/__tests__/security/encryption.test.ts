import { describe, expect, it } from 'vitest';
import { EncryptionSystem, TokenGenerator } from '../../security/encryption.js';

describe('EncryptionSystem', () => {
  it('generates a CryptoKey', async () => {
    const enc = new EncryptionSystem();
    const key = await enc.generateKey('k1');
    expect(key).toBeTruthy();
    expect(key.type).toBe('secret');
  });

  it('encrypt/decrypt roundtrip returns original plaintext', async () => {
    const enc = new EncryptionSystem();
    const key = await enc.generateKey('k1');
    const plaintext = 'secret data';
    const encrypted = await enc.encrypt(plaintext, key);
    const decrypted = await enc.decrypt(encrypted, key);
    expect(decrypted).toBe(plaintext);
  });

  it('same plaintext produces different ciphertext (random IV)', async () => {
    const enc = new EncryptionSystem();
    const key = await enc.generateKey();
    const a = await enc.encrypt('hello', key);
    const b = await enc.encrypt('hello', key);
    // IVs should differ
    expect(a.iv).not.toBe(b.iv);
  });

  it('decrypting with wrong key throws or returns different result', async () => {
    const enc = new EncryptionSystem();
    const key1 = await enc.generateKey();
    const key2 = await enc.generateKey();
    const encrypted = await enc.encrypt('secret', key1);
    await expect(enc.decrypt(encrypted, key2)).rejects.toThrow();
  });

  it('stores key under named id and retrieves it', async () => {
    const enc = new EncryptionSystem();
    await enc.generateKey('myKey');
    const key = enc.getKey('myKey');
    expect(key).toBeTruthy();
  });
});

describe('TokenGenerator', () => {
  it('generates a token with sufficient entropy', () => {
    const token = TokenGenerator.generate();
    // Default 32 bytes → 64 hex chars
    expect(token.length).toBeGreaterThanOrEqual(32);
  });

  it('generates unique tokens', () => {
    const tokens = new Set(Array.from({ length: 10 }, () => TokenGenerator.generate()));
    expect(tokens.size).toBe(10);
  });

  it('respects custom length', () => {
    const token = TokenGenerator.generate(16);
    // 16 bytes → 32 hex chars
    expect(token.length).toBe(32);
  });
});
