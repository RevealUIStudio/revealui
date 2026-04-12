import { beforeEach, describe, expect, it } from 'vitest';
import type { EncryptedData } from '../encryption.js';
import {
  DataMasking,
  EncryptionSystem,
  EnvelopeEncryption,
  FieldEncryption,
  KeyRotationManager,
  TokenGenerator,
} from '../encryption.js';

describe('EncryptionSystem', () => {
  let enc: EncryptionSystem;

  beforeEach(() => {
    enc = new EncryptionSystem();
  });

  describe('generateKey', () => {
    it('returns a CryptoKey', async () => {
      const key = await enc.generateKey();
      expect(key).toBeDefined();
      expect(key.type).toBe('secret');
      expect(key.algorithm.name).toBe('AES-GCM');
    });

    it('stores key when keyId is provided', async () => {
      const key = await enc.generateKey('test-key');
      expect(enc.getKey('test-key')).toBe(key);
    });

    it('does not store key when no keyId is provided', async () => {
      await enc.generateKey();
      expect(enc.getKey('any')).toBeUndefined();
    });
  });

  describe('importKey / exportKey roundtrip', () => {
    it('exports and re-imports a key that can decrypt', async () => {
      // Export/import requires extractable keys
      const extractableEnc = new EncryptionSystem({ extractable: true });
      const original = await extractableEnc.generateKey();
      const exported = await extractableEnc.exportKey(original);
      expect(exported).toBeInstanceOf(ArrayBuffer);
      expect(exported.byteLength).toBe(32); // 256 bits

      const imported = await extractableEnc.importKey(exported);
      // Encrypt with original, decrypt with imported
      const encrypted = await extractableEnc.encrypt('roundtrip test', original);
      const decrypted = await extractableEnc.decrypt(encrypted, imported);
      expect(decrypted).toBe('roundtrip test');
    });

    it('stores imported key when keyId is provided', async () => {
      const extractableEnc = new EncryptionSystem({ extractable: true });
      const original = await extractableEnc.generateKey();
      const exported = await extractableEnc.exportKey(original);
      const imported = await extractableEnc.importKey(exported, 'imported-key');
      expect(extractableEnc.getKey('imported-key')).toBe(imported);
    });
  });

  describe('encrypt / decrypt', () => {
    it('roundtrips a string with a CryptoKey', async () => {
      const key = await enc.generateKey();
      const plaintext = 'Hello, World!';
      const encrypted = await enc.encrypt(plaintext, key);

      expect(encrypted.data).toBeTruthy();
      expect(encrypted.iv).toBeTruthy();
      expect(encrypted.algorithm).toBe('AES-GCM');
      expect(encrypted.data).not.toBe(plaintext);

      const decrypted = await enc.decrypt(encrypted, key);
      expect(decrypted).toBe(plaintext);
    });

    it('roundtrips using a stored key by ID', async () => {
      await enc.generateKey('my-key');
      const encrypted = await enc.encrypt('secret data', 'my-key');
      const decrypted = await enc.decrypt(encrypted, 'my-key');
      expect(decrypted).toBe('secret data');
    });

    it('throws when key ID is not found during encrypt', async () => {
      await expect(enc.encrypt('data', 'nonexistent')).rejects.toThrow('Key not found');
    });

    it('throws when key ID is not found during decrypt', async () => {
      const key = await enc.generateKey();
      const encrypted = await enc.encrypt('data', key);
      await expect(enc.decrypt(encrypted, 'nonexistent')).rejects.toThrow('Key not found');
    });

    it('cannot decrypt with a different key', async () => {
      const key1 = await enc.generateKey();
      const key2 = await enc.generateKey();
      const encrypted = await enc.encrypt('secret', key1);
      await expect(enc.decrypt(encrypted, key2)).rejects.toThrow();
    });

    it('handles empty string', async () => {
      const key = await enc.generateKey();
      const encrypted = await enc.encrypt('', key);
      const decrypted = await enc.decrypt(encrypted, key);
      expect(decrypted).toBe('');
    });

    it('handles unicode content', async () => {
      const key = await enc.generateKey();
      const plaintext = 'Hello \u{1F30D} \u00E9\u00E0\u00FC \u4E16\u754C';
      const encrypted = await enc.encrypt(plaintext, key);
      const decrypted = await enc.decrypt(encrypted, key);
      expect(decrypted).toBe(plaintext);
    });

    it('produces different ciphertext for same plaintext (random IV)', async () => {
      const key = await enc.generateKey();
      const encrypted1 = await enc.encrypt('same data', key);
      const encrypted2 = await enc.encrypt('same data', key);
      // IVs should differ, so ciphertext differs
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.data).not.toBe(encrypted2.data);
    });
  });

  describe('encryptObject / decryptObject', () => {
    it('roundtrips an object', async () => {
      const key = await enc.generateKey();
      const obj = { name: 'Alice', age: 30, nested: { role: 'admin' } };
      const encrypted = await enc.encryptObject(obj, key);
      const decrypted = await enc.decryptObject<typeof obj>(encrypted, key);
      expect(decrypted).toEqual(obj);
    });

    it('roundtrips an object by key ID', async () => {
      await enc.generateKey('obj-key');
      const obj = { x: 1, y: [2, 3] };
      const encrypted = await enc.encryptObject(obj, 'obj-key');
      const decrypted = await enc.decryptObject<typeof obj>(encrypted, 'obj-key');
      expect(decrypted).toEqual(obj);
    });
  });

  describe('hash', () => {
    it('produces a consistent SHA-256 hash', async () => {
      const hash1 = await enc.hash('test data');
      const hash2 = await enc.hash('test data');
      expect(hash1).toBe(hash2);
      expect(hash1).toBeTruthy();
    });

    it('produces different hashes for different input', async () => {
      const hash1 = await enc.hash('data A');
      const hash2 = await enc.hash('data B');
      expect(hash1).not.toBe(hash2);
    });

    it('supports SHA-384', async () => {
      const hash256 = await enc.hash('test', 'SHA-256');
      const hash384 = await enc.hash('test', 'SHA-384');
      expect(hash384).not.toBe(hash256);
      // SHA-384 produces 48 bytes = 64 base64 chars
      expect(hash384.length).toBeGreaterThan(hash256.length);
    });

    it('supports SHA-512', async () => {
      const hash256 = await enc.hash('test', 'SHA-256');
      const hash512 = await enc.hash('test', 'SHA-512');
      expect(hash512).not.toBe(hash256);
      // SHA-512 produces 64 bytes = longer base64 than SHA-256 (32 bytes)
      expect(hash512.length).toBeGreaterThan(hash256.length);
    });
  });

  describe('randomBytes', () => {
    it('returns correct length', () => {
      const bytes16 = enc.randomBytes(16);
      expect(bytes16).toBeInstanceOf(Uint8Array);
      expect(bytes16.length).toBe(16);

      const bytes64 = enc.randomBytes(64);
      expect(bytes64.length).toBe(64);
    });

    it('produces different output on successive calls', () => {
      const a = enc.randomBytes(32);
      const b = enc.randomBytes(32);
      // Technically could be equal, but astronomically unlikely for 32 bytes
      const aHex = Array.from(a)
        .map((x) => x.toString(16))
        .join('');
      const bHex = Array.from(b)
        .map((x) => x.toString(16))
        .join('');
      expect(aHex).not.toBe(bHex);
    });
  });

  describe('randomString', () => {
    it('returns correct length with default charset', () => {
      const str = enc.randomString(20);
      expect(str.length).toBe(20);
    });

    it('uses only characters from the given charset', () => {
      const charset = 'abc123';
      const str = enc.randomString(100, charset);
      expect(str.length).toBe(100);
      for (const ch of str) {
        expect(charset).toContain(ch);
      }
    });

    it('returns empty string for length 0', () => {
      expect(enc.randomString(0)).toBe('');
    });

    it('produces different strings on successive calls', () => {
      const a = enc.randomString(32);
      const b = enc.randomString(32);
      expect(a).not.toBe(b);
    });

    it('uses rejection sampling to avoid modulo bias', () => {
      // With a charset of length 200, maxValid = 256 - (256 % 200) = 256 - 56 = 200
      // Bytes >= 200 are rejected, so we need more bytes than the output length
      // This test verifies the function still completes and returns the right length
      const charset = 'A'
        .repeat(200)
        .split('')
        .map((_, i) => String.fromCharCode(33 + (i % 94)))
        .join('')
        .slice(0, 200);
      const str = enc.randomString(50, charset);
      expect(str.length).toBe(50);
      for (const ch of str) {
        expect(charset).toContain(ch);
      }
    });
  });

  describe('storeKey / getKey / removeKey / clearKeys', () => {
    it('stores and retrieves a key', async () => {
      const key = await enc.generateKey();
      enc.storeKey('stored', key);
      expect(enc.getKey('stored')).toBe(key);
    });

    it('returns undefined for unknown key', () => {
      expect(enc.getKey('nope')).toBeUndefined();
    });

    it('removes a specific key', async () => {
      const key = await enc.generateKey('to-remove');
      expect(enc.getKey('to-remove')).toBe(key);
      enc.removeKey('to-remove');
      expect(enc.getKey('to-remove')).toBeUndefined();
    });

    it('clears all keys', async () => {
      await enc.generateKey('k1');
      await enc.generateKey('k2');
      expect(enc.getKey('k1')).toBeDefined();
      expect(enc.getKey('k2')).toBeDefined();
      enc.clearKeys();
      expect(enc.getKey('k1')).toBeUndefined();
      expect(enc.getKey('k2')).toBeUndefined();
    });
  });

  describe('custom config', () => {
    it('uses AES-GCM with 128-bit key size', async () => {
      const enc128 = new EncryptionSystem({ keySize: 128, extractable: true });
      const key = await enc128.generateKey();
      const exported = await enc128.exportKey(key);
      expect(exported.byteLength).toBe(16); // 128 bits
      const encrypted = await enc128.encrypt('test 128', key);
      const decrypted = await enc128.decrypt(encrypted, key);
      expect(decrypted).toBe('test 128');
    });
  });
});

describe('FieldEncryption', () => {
  let enc: EncryptionSystem;
  let fe: FieldEncryption;

  beforeEach(async () => {
    enc = new EncryptionSystem();
    fe = new FieldEncryption(enc);
  });

  describe('when not initialized', () => {
    it('throws on encryptField', async () => {
      await expect(fe.encryptField('value')).rejects.toThrow('Encryption not initialized');
    });

    it('throws on decryptField', async () => {
      const fakeData: EncryptedData = { data: 'x', iv: 'y', algorithm: 'AES-GCM' };
      await expect(fe.decryptField(fakeData)).rejects.toThrow('Encryption not initialized');
    });
  });

  describe('when initialized', () => {
    let key: CryptoKey;

    beforeEach(async () => {
      key = await enc.generateKey();
      await fe.initialize(key);
    });

    it('encrypts and decrypts a string field', async () => {
      const encrypted = await fe.encryptField('hello');
      expect(encrypted.data).toBeTruthy();
      expect(encrypted.algorithm).toBe('AES-GCM');
      const decrypted = await fe.decryptField(encrypted);
      expect(decrypted).toBe('hello');
    });

    it('encrypts and decrypts an object field (auto-JSON)', async () => {
      const obj = { foo: 'bar', count: 42 };
      const encrypted = await fe.encryptField(obj);
      const decrypted = await fe.decryptField(encrypted);
      expect(decrypted).toEqual(obj);
    });

    it('encrypts and decrypts a number field', async () => {
      const encrypted = await fe.encryptField(12345);
      const decrypted = await fe.decryptField(encrypted);
      expect(decrypted).toBe(12345);
    });

    it('encrypts and decrypts a boolean field', async () => {
      const encrypted = await fe.encryptField(true);
      const decrypted = await fe.decryptField(encrypted);
      expect(decrypted).toBe(true);
    });
  });

  describe('encryptFields / decryptFields', () => {
    it('selectively encrypts and decrypts specified fields', async () => {
      const key = await enc.generateKey();
      await fe.initialize(key);

      const original = { name: 'Alice', email: 'alice@example.com', public: 'visible' };
      const encrypted = await fe.encryptFields(original, ['name', 'email']);

      // public field should be untouched
      expect(encrypted.public).toBe('visible');
      // encrypted fields should be EncryptedData objects
      expect((encrypted.name as unknown as EncryptedData).data).toBeTruthy();
      expect((encrypted.name as unknown as EncryptedData).iv).toBeTruthy();
      expect((encrypted.email as unknown as EncryptedData).data).toBeTruthy();

      const decrypted = await fe.decryptFields(encrypted, ['name', 'email']);
      expect(decrypted.name).toBe('Alice');
      expect(decrypted.email).toBe('alice@example.com');
      expect(decrypted.public).toBe('visible');
    });

    it('skips fields not present in the object', async () => {
      const key = await enc.generateKey();
      await fe.initialize(key);

      const original = { a: 'value' };
      const encrypted = await fe.encryptFields(original, ['a', 'b' as keyof typeof original]);
      // Should not throw; 'b' is simply skipped
      expect((encrypted.a as unknown as EncryptedData).data).toBeTruthy();
    });

    it('skips non-object fields during decryptFields', async () => {
      const key = await enc.generateKey();
      await fe.initialize(key);

      // Manually create an object where a "field" is a string, not EncryptedData
      const obj = { name: 'plain string', age: 30 };
      const result = await fe.decryptFields(obj, ['name', 'age']);
      // Neither field looks like EncryptedData, so they stay as-is
      expect(result.name).toBe('plain string');
      expect(result.age).toBe(30);
    });
  });
});

describe('KeyRotationManager', () => {
  let enc: EncryptionSystem;

  beforeEach(() => {
    enc = new EncryptionSystem();
  });

  it('returns the initial key ID as current', async () => {
    await enc.generateKey('key-v1');
    const mgr = new KeyRotationManager(enc, 'key-v1');
    expect(mgr.getCurrentKeyId()).toBe('key-v1');
  });

  it('rotates to a new key and updates current ID', async () => {
    await enc.generateKey('key-v1');
    const mgr = new KeyRotationManager(enc, 'key-v1');

    const newKey = await enc.generateKey();
    await mgr.rotate('key-v2', newKey);

    expect(mgr.getCurrentKeyId()).toBe('key-v2');
    expect(enc.getKey('key-v2')).toBe(newKey);
  });

  it('re-encrypts data from old key to new key', async () => {
    const oldKey = await enc.generateKey('key-v1');
    const mgr = new KeyRotationManager(enc, 'key-v1');

    // Encrypt with old key
    const encrypted = await enc.encrypt('sensitive data', oldKey);

    // Rotate
    const newKey = await enc.generateKey();
    await mgr.rotate('key-v2', newKey);

    // Re-encrypt
    const reencrypted = await mgr.reencrypt(encrypted, 'key-v1');

    // Should decrypt with new key
    const decrypted = await enc.decrypt(reencrypted, 'key-v2');
    expect(decrypted).toBe('sensitive data');
  });

  it('throws when re-encrypting with missing keys', async () => {
    const mgr = new KeyRotationManager(enc, 'key-v1');
    const fakeEncrypted: EncryptedData = { data: 'x', iv: 'y', algorithm: 'AES-GCM' };
    await expect(mgr.reencrypt(fakeEncrypted, 'missing')).rejects.toThrow('Keys not found');
  });

  it('cleanupOldKeys removes expired keys but keeps current', async () => {
    await enc.generateKey('key-v1');
    const mgr = new KeyRotationManager(enc, 'key-v1');

    const newKey = await enc.generateKey();
    await mgr.rotate('key-v2', newKey);

    // Cleanup keys older than now + 1 second (all old keys should be removed)
    const future = new Date(Date.now() + 1000);
    mgr.cleanupOldKeys(future);

    // Current key should still be accessible
    expect(mgr.getCurrentKeyId()).toBe('key-v2');
    expect(enc.getKey('key-v2')).toBe(newKey);
  });

  it('cleanupOldKeys does not remove keys newer than cutoff', async () => {
    await enc.generateKey('key-v1');
    const mgr = new KeyRotationManager(enc, 'key-v1');

    const newKey = await enc.generateKey();
    await mgr.rotate('key-v2', newKey);

    // Use a past date  -  nothing should be removed
    const past = new Date(Date.now() - 60_000);
    mgr.cleanupOldKeys(past);

    // key-v2 is current so always kept; key-v1 was created after `past`, so also kept
    expect(mgr.getCurrentKeyId()).toBe('key-v2');
  });

  it('supports multiple rotations and re-encryption', async () => {
    const key1 = await enc.generateKey('key-v1');
    const mgr = new KeyRotationManager(enc, 'key-v1');

    const encrypted = await enc.encrypt('original', key1);

    const key2 = await enc.generateKey();
    await mgr.rotate('key-v2', key2);

    const key3 = await enc.generateKey();
    await mgr.rotate('key-v3', key3);

    // Re-encrypt from v1 to v3 (current)
    const reencrypted = await mgr.reencrypt(encrypted, 'key-v1');
    const decrypted = await enc.decrypt(reencrypted, 'key-v3');
    expect(decrypted).toBe('original');
  });
});

describe('EnvelopeEncryption', () => {
  let enc: EncryptionSystem;

  beforeEach(() => {
    // Envelope encryption requires extractable keys (DEKs are exported to wrap with master key)
    enc = new EncryptionSystem({ extractable: true });
  });

  it('encrypts and decrypts with envelope encryption', async () => {
    const masterKey = await enc.generateKey();
    const envelope = new EnvelopeEncryption(enc, masterKey);

    const plaintext = 'large payload for envelope encryption';
    const { encryptedData, encryptedKey } = await envelope.encrypt(plaintext);

    expect(encryptedData.data).toBeTruthy();
    expect(encryptedKey.data).toBeTruthy();

    const decrypted = await envelope.decrypt(encryptedData, encryptedKey);
    expect(decrypted).toBe(plaintext);
  });

  it('generates a unique DEK per encrypt call', async () => {
    const masterKey = await enc.generateKey();
    const envelope = new EnvelopeEncryption(enc, masterKey);

    const result1 = await envelope.encrypt('data');
    const result2 = await envelope.encrypt('data');

    // Encrypted keys (wrapped DEKs) should differ because DEKs are different
    expect(result1.encryptedKey.data).not.toBe(result2.encryptedKey.data);
  });

  it('cannot decrypt with a different master key', async () => {
    const masterKey1 = await enc.generateKey();
    const masterKey2 = await enc.generateKey();

    const envelope1 = new EnvelopeEncryption(enc, masterKey1);
    const envelope2 = new EnvelopeEncryption(enc, masterKey2);

    const { encryptedData, encryptedKey } = await envelope1.encrypt('secret');
    await expect(envelope2.decrypt(encryptedData, encryptedKey)).rejects.toThrow();
  });

  it('handles empty string', async () => {
    const masterKey = await enc.generateKey();
    const envelope = new EnvelopeEncryption(enc, masterKey);

    const { encryptedData, encryptedKey } = await envelope.encrypt('');
    const decrypted = await envelope.decrypt(encryptedData, encryptedKey);
    expect(decrypted).toBe('');
  });
});

describe('DataMasking', () => {
  describe('maskEmail', () => {
    it('masks a normal email', () => {
      expect(DataMasking.maskEmail('alice@example.com')).toBe('a***e@example.com');
    });

    it('masks a longer local part', () => {
      expect(DataMasking.maskEmail('jonathan@test.com')).toBe('j******n@test.com');
    });

    it('masks a 2-character local part', () => {
      // local.length <= 2: returns local[0] + '*'
      expect(DataMasking.maskEmail('ab@test.com')).toBe('a*@test.com');
    });

    it('masks a 1-character local part', () => {
      expect(DataMasking.maskEmail('a@test.com')).toBe('a*@test.com');
    });

    it('returns input unchanged if no @ sign', () => {
      expect(DataMasking.maskEmail('no-at-sign')).toBe('no-at-sign');
    });
  });

  describe('maskPhone', () => {
    it('masks a 10-digit US number', () => {
      const masked = DataMasking.maskPhone('555-123-4567');
      // Last 4 digits preserved: 4567
      expect(masked).toContain('4567');
      expect(masked).toContain('*');
    });

    it('masks a number with country code', () => {
      const masked = DataMasking.maskPhone('+1 555 123 4567');
      expect(masked).toContain('4567');
    });

    it('returns input unchanged for short numbers (< 4 digits)', () => {
      expect(DataMasking.maskPhone('123')).toBe('123');
    });

    it('masks exactly 4 digits correctly', () => {
      // digits.length === 4 → masked = '' + lastFour
      const masked = DataMasking.maskPhone('1234');
      expect(masked).toBe('1234');
    });
  });

  describe('maskCreditCard', () => {
    it('masks a standard 16-digit card', () => {
      expect(DataMasking.maskCreditCard('4111111111111111')).toBe('****-****-****-1111');
    });

    it('masks a card with spaces', () => {
      expect(DataMasking.maskCreditCard('4111 1111 1111 1111')).toBe('****-****-****-1111');
    });

    it('masks a card with dashes', () => {
      expect(DataMasking.maskCreditCard('4111-1111-1111-1111')).toBe('****-****-****-1111');
    });

    it('returns input unchanged for short numbers (< 4 digits)', () => {
      expect(DataMasking.maskCreditCard('123')).toBe('123');
    });
  });

  describe('maskSSN', () => {
    it('masks a standard 9-digit SSN', () => {
      expect(DataMasking.maskSSN('123-45-6789')).toBe('***-**-6789');
    });

    it('masks a SSN without dashes', () => {
      expect(DataMasking.maskSSN('123456789')).toBe('***-**-6789');
    });

    it('returns input unchanged for wrong length', () => {
      expect(DataMasking.maskSSN('12345')).toBe('12345');
      expect(DataMasking.maskSSN('1234567890')).toBe('1234567890');
    });
  });

  describe('maskString', () => {
    it('masks a normal string keeping first and last char', () => {
      expect(DataMasking.maskString('password')).toBe('p******d');
    });

    it('masks with custom keepChars', () => {
      expect(DataMasking.maskString('mysecretvalue', 3)).toBe('mys*******lue');
    });

    it('returns all asterisks for short strings', () => {
      // str.length <= keepChars * 2
      expect(DataMasking.maskString('ab')).toBe('**');
      expect(DataMasking.maskString('a')).toBe('*');
    });

    it('masks exactly at boundary (length === keepChars * 2 + 1)', () => {
      // length 3 with keepChars 1: prefix='a', suffix='c', masked='*'
      expect(DataMasking.maskString('abc')).toBe('a*c');
    });

    it('returns all asterisks when keepChars equals half the string length', () => {
      // length 4 with keepChars 2: 4 <= 2*2, returns '****'
      expect(DataMasking.maskString('abcd', 2)).toBe('****');
    });
  });
});

describe('TokenGenerator', () => {
  describe('generate', () => {
    it('returns a hex string of default length (64 hex chars for 32 bytes)', () => {
      const token = TokenGenerator.generate();
      expect(token.length).toBe(64);
      expect(token).toMatch(/^[0-9a-f]+$/);
    });

    it('returns hex string of specified byte length', () => {
      const token = TokenGenerator.generate(16);
      expect(token.length).toBe(32); // 16 bytes * 2 hex chars
      expect(token).toMatch(/^[0-9a-f]+$/);
    });

    it('produces unique tokens', () => {
      const tokens = new Set(Array.from({ length: 10 }, () => TokenGenerator.generate()));
      expect(tokens.size).toBe(10);
    });
  });

  describe('generateUUID', () => {
    it('returns a valid UUID v4 format', () => {
      const uuid = TokenGenerator.generateUUID();
      // UUID v4: xxxxxxxx-xxxx-4xxx-[89ab]xxx-xxxxxxxxxxxx
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it('produces unique UUIDs', () => {
      const uuids = new Set(Array.from({ length: 10 }, () => TokenGenerator.generateUUID()));
      expect(uuids.size).toBe(10);
    });
  });

  describe('generateAPIKey', () => {
    it('has correct default prefix', () => {
      const key = TokenGenerator.generateAPIKey();
      expect(key).toMatch(/^sk_[0-9a-f]{64}$/);
    });

    it('uses custom prefix', () => {
      const key = TokenGenerator.generateAPIKey('pk');
      expect(key).toMatch(/^pk_[0-9a-f]{64}$/);
    });
  });

  describe('generateSessionID', () => {
    it('returns 128 hex characters (64 bytes)', () => {
      const sid = TokenGenerator.generateSessionID();
      expect(sid.length).toBe(128);
      expect(sid).toMatch(/^[0-9a-f]+$/);
    });

    it('produces unique session IDs', () => {
      const sids = new Set(Array.from({ length: 10 }, () => TokenGenerator.generateSessionID()));
      expect(sids.size).toBe(10);
    });
  });
});
