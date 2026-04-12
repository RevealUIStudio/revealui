/**
 * Encryption Utilities
 *
 * Data encryption for at-rest and in-transit protection
 */

export interface EncryptionConfig {
  algorithm: 'AES-GCM' | 'AES-CTR';
  keySize: 128 | 192 | 256;
  ivSize?: number;
  /** Allow key export via exportKey(). Default: false (keys are non-extractable). */
  extractable?: boolean;
}

export interface EncryptedData {
  data: string;
  iv: string;
  tag?: string;
  algorithm: string;
}

const DEFAULT_CONFIG: EncryptionConfig = {
  algorithm: 'AES-GCM',
  keySize: 256,
  ivSize: 12,
};

/**
 * Encryption system
 */
export class EncryptionSystem {
  private config: EncryptionConfig;
  private keys: Map<string, CryptoKey> = new Map();

  constructor(config: Partial<EncryptionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate encryption key
   */
  async generateKey(keyId?: string): Promise<CryptoKey> {
    const crypto = globalThis.crypto;
    if (!crypto) {
      throw new Error('Crypto API not available');
    }

    const key = await crypto.subtle.generateKey(
      {
        name: this.config.algorithm,
        length: this.config.keySize,
      },
      this.config.extractable ?? false, // non-extractable by default  -  prevents key exfiltration
      ['encrypt', 'decrypt'],
    );

    if (keyId) {
      this.keys.set(keyId, key);
    }

    return key;
  }

  /**
   * Import key from raw data
   */
  async importKey(keyData: ArrayBuffer, keyId?: string): Promise<CryptoKey> {
    const crypto = globalThis.crypto;
    if (!crypto) {
      throw new Error('Crypto API not available');
    }

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      {
        name: this.config.algorithm,
        length: this.config.keySize,
      },
      this.config.extractable ?? false, // non-extractable by default  -  prevents key exfiltration
      ['encrypt', 'decrypt'],
    );

    if (keyId) {
      this.keys.set(keyId, key);
    }

    return key;
  }

  /**
   * Export key to raw data
   */
  async exportKey(key: CryptoKey): Promise<ArrayBuffer> {
    const crypto = globalThis.crypto;
    if (!crypto) {
      throw new Error('Crypto API not available');
    }

    return crypto.subtle.exportKey('raw', key);
  }

  /**
   * Encrypt data
   */
  async encrypt(data: string, keyOrId: CryptoKey | string): Promise<EncryptedData> {
    const crypto = globalThis.crypto;
    if (!crypto) {
      throw new Error('Crypto API not available');
    }

    // Get key
    const key = typeof keyOrId === 'string' ? this.keys.get(keyOrId) : keyOrId;

    if (!key) {
      throw new Error('Key not found');
    }

    // Generate IV
    const iv = crypto.getRandomValues(new Uint8Array(this.config.ivSize || 12));

    // Encode data
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(data);

    // Encrypt
    const encrypted = await crypto.subtle.encrypt(
      {
        name: this.config.algorithm,
        iv,
      },
      key,
      encodedData,
    );

    // Convert to base64
    const encryptedArray = new Uint8Array(encrypted);
    const ivArray = new Uint8Array(iv);

    return {
      data: this.arrayBufferToBase64(encryptedArray),
      iv: this.arrayBufferToBase64(ivArray),
      algorithm: this.config.algorithm,
    };
  }

  /**
   * Decrypt data
   */
  async decrypt(encryptedData: EncryptedData, keyOrId: CryptoKey | string): Promise<string> {
    const crypto = globalThis.crypto;
    if (!crypto) {
      throw new Error('Crypto API not available');
    }

    // Get key
    const key = typeof keyOrId === 'string' ? this.keys.get(keyOrId) : keyOrId;

    if (!key) {
      throw new Error('Key not found');
    }

    // Decode data
    const data = this.base64ToArrayBuffer(encryptedData.data);
    const iv = this.base64ToArrayBuffer(encryptedData.iv);

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      {
        name: encryptedData.algorithm,
        iv: iv as BufferSource,
      },
      key,
      data as BufferSource,
    );

    // Decode text
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  /**
   * Encrypt object
   */
  async encryptObject<T extends Record<string, unknown>>(
    obj: T,
    keyOrId: CryptoKey | string,
  ): Promise<EncryptedData> {
    const json = JSON.stringify(obj);
    return this.encrypt(json, keyOrId);
  }

  /**
   * Decrypt object
   */
  async decryptObject<T extends Record<string, unknown>>(
    encryptedData: EncryptedData,
    keyOrId: CryptoKey | string,
  ): Promise<T> {
    const json = await this.decrypt(encryptedData, keyOrId);
    return JSON.parse(json);
  }

  /**
   * Hash data
   */
  async hash(
    data: string,
    algorithm: 'SHA-256' | 'SHA-384' | 'SHA-512' = 'SHA-256',
  ): Promise<string> {
    const crypto = globalThis.crypto;
    if (!crypto) {
      throw new Error('Crypto API not available');
    }

    const encoder = new TextEncoder();
    const encodedData = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest(algorithm, encodedData);

    return this.arrayBufferToBase64(new Uint8Array(hashBuffer));
  }

  /**
   * Generate random bytes
   */
  randomBytes(length: number): Uint8Array {
    const crypto = globalThis.crypto;
    if (!crypto) {
      throw new Error('Crypto API not available');
    }

    return crypto.getRandomValues(new Uint8Array(length));
  }

  /**
   * Generate random string
   */
  randomString(
    length: number,
    charset: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  ): string {
    // Rejection sampling to avoid modulo bias:
    // Only accept bytes below the largest multiple of charset.length that fits in a byte.
    const maxValid = 256 - (256 % charset.length);
    const result: string[] = [];
    while (result.length < length) {
      const bytes = this.randomBytes(length - result.length + 16);
      for (const byte of bytes) {
        if (byte < maxValid) {
          result.push(charset[byte % charset.length] as string);
          if (result.length === length) break;
        }
      }
    }
    return result.join('');
  }

  /**
   * Convert ArrayBuffer to base64
   */
  private arrayBufferToBase64(buffer: Uint8Array): string {
    const bytes = Array.from(buffer);
    const binary = bytes.map((byte) => String.fromCharCode(byte)).join('');

    if (typeof btoa !== 'undefined') {
      return btoa(binary);
    }

    if (typeof Buffer !== 'undefined') {
      return Buffer.from(binary, 'binary').toString('base64');
    }

    throw new Error('No base64 encoding available');
  }

  /**
   * Convert base64 to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): Uint8Array {
    let binary: string;

    if (typeof atob !== 'undefined') {
      binary = atob(base64);
    } else if (typeof Buffer !== 'undefined') {
      binary = Buffer.from(base64, 'base64').toString('binary');
    } else {
      throw new Error('No base64 decoding available');
    }

    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
  }

  /**
   * Store key
   */
  storeKey(keyId: string, key: CryptoKey): void {
    this.keys.set(keyId, key);
  }

  /**
   * Get key
   */
  getKey(keyId: string): CryptoKey | undefined {
    return this.keys.get(keyId);
  }

  /**
   * Remove key
   */
  removeKey(keyId: string): void {
    this.keys.delete(keyId);
  }

  /**
   * Clear all keys
   */
  clearKeys(): void {
    this.keys.clear();
  }
}

/**
 * Global encryption instance
 */
export const encryption = new EncryptionSystem();

/**
 * Field-level encryption
 */
export class FieldEncryption {
  private encryption: EncryptionSystem;
  private key: CryptoKey | null = null;

  constructor(encryption: EncryptionSystem) {
    this.encryption = encryption;
  }

  /**
   * Initialize with key
   */
  async initialize(key: CryptoKey): Promise<void> {
    this.key = key;
  }

  /**
   * Encrypt field
   */
  async encryptField(value: unknown): Promise<EncryptedData> {
    if (!this.key) {
      throw new Error('Encryption not initialized');
    }

    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    return this.encryption.encrypt(stringValue, this.key);
  }

  /**
   * Decrypt field
   */
  async decryptField(encryptedData: EncryptedData): Promise<unknown> {
    if (!this.key) {
      throw new Error('Encryption not initialized');
    }

    const decrypted = await this.encryption.decrypt(encryptedData, this.key);

    // Try to parse as JSON
    try {
      return JSON.parse(decrypted);
    } catch {
      return decrypted;
    }
  }

  /**
   * Encrypt object fields
   */
  async encryptFields<T extends Record<string, unknown>>(obj: T, fields: (keyof T)[]): Promise<T> {
    const result = { ...obj };

    for (const field of fields) {
      if (field in result) {
        result[field] = (await this.encryptField(result[field])) as unknown as T[keyof T];
      }
    }

    return result;
  }

  /**
   * Decrypt object fields
   */
  async decryptFields<T extends Record<string, unknown>>(obj: T, fields: (keyof T)[]): Promise<T> {
    const result = { ...obj };

    for (const field of fields) {
      if (field in result && typeof result[field] === 'object' && result[field] !== null) {
        const encryptedData = result[field] as unknown as EncryptedData;
        if ('data' in encryptedData && 'iv' in encryptedData) {
          result[field] = (await this.decryptField(encryptedData)) as unknown as T[keyof T];
        }
      }
    }

    return result;
  }
}

/**
 * Key rotation
 */
export class KeyRotationManager {
  private encryption: EncryptionSystem;
  private currentKeyId: string;
  private oldKeys: Map<string, CryptoKey> = new Map();
  private keyCreationDates: Map<string, Date> = new Map();

  constructor(encryption: EncryptionSystem, initialKeyId: string) {
    this.encryption = encryption;
    this.currentKeyId = initialKeyId;
    this.keyCreationDates.set(initialKeyId, new Date());
  }

  /**
   * Rotate to new key
   */
  async rotate(newKeyId: string, newKey: CryptoKey): Promise<void> {
    // Store old key
    const oldKey = this.encryption.getKey(this.currentKeyId);
    if (oldKey) {
      this.oldKeys.set(this.currentKeyId, oldKey);
    }

    // Set new key
    this.encryption.storeKey(newKeyId, newKey);
    this.currentKeyId = newKeyId;
    this.keyCreationDates.set(newKeyId, new Date());
  }

  /**
   * Re-encrypt data with new key
   */
  async reencrypt(encryptedData: EncryptedData, oldKeyId: string): Promise<EncryptedData> {
    // Get keys
    const oldKey = this.oldKeys.get(oldKeyId) || this.encryption.getKey(oldKeyId);
    const newKey = this.encryption.getKey(this.currentKeyId);

    if (!(oldKey && newKey)) {
      throw new Error('Keys not found');
    }

    // Decrypt with old key
    const decrypted = await this.encryption.decrypt(encryptedData, oldKey);

    // Encrypt with new key
    return this.encryption.encrypt(decrypted, newKey);
  }

  /**
   * Get current key ID
   */
  getCurrentKeyId(): string {
    return this.currentKeyId;
  }

  /**
   * Clean up old keys created before the specified date.
   * Never removes the current active key.
   */
  cleanupOldKeys(olderThan: Date): void {
    for (const [keyId, createdAt] of this.keyCreationDates.entries()) {
      if (keyId !== this.currentKeyId && createdAt < olderThan) {
        this.oldKeys.delete(keyId);
        this.encryption.removeKey(keyId);
        this.keyCreationDates.delete(keyId);
      }
    }
  }
}

/**
 * Envelope encryption for large data
 */
export class EnvelopeEncryption {
  private encryption: EncryptionSystem;
  private masterKey: CryptoKey;

  constructor(encryption: EncryptionSystem, masterKey: CryptoKey) {
    this.encryption = encryption;
    this.masterKey = masterKey;
  }

  /**
   * Encrypt with envelope encryption
   */
  async encrypt(data: string): Promise<{
    encryptedData: EncryptedData;
    encryptedKey: EncryptedData;
  }> {
    // Generate data encryption key (DEK)
    const dek = await this.encryption.generateKey();

    // Encrypt data with DEK
    const encryptedData = await this.encryption.encrypt(data, dek);

    // Export DEK
    const dekRaw = await this.encryption.exportKey(dek);
    const dekBase64 = this.arrayBufferToBase64(new Uint8Array(dekRaw));

    // Encrypt DEK with master key
    const encryptedKey = await this.encryption.encrypt(dekBase64, this.masterKey);

    return { encryptedData, encryptedKey };
  }

  /**
   * Decrypt with envelope encryption
   */
  async decrypt(encryptedData: EncryptedData, encryptedKey: EncryptedData): Promise<string> {
    // Decrypt DEK with master key
    const dekBase64 = await this.encryption.decrypt(encryptedKey, this.masterKey);
    const dekRaw = this.base64ToArrayBuffer(dekBase64);

    // Import DEK
    const dek = await this.encryption.importKey(dekRaw.buffer as ArrayBuffer);

    // Decrypt data with DEK
    return this.encryption.decrypt(encryptedData, dek);
  }

  private arrayBufferToBase64(buffer: Uint8Array): string {
    const bytes = Array.from(buffer);
    const binary = bytes.map((byte) => String.fromCharCode(byte)).join('');
    return typeof btoa !== 'undefined'
      ? btoa(binary)
      : Buffer.from(binary, 'binary').toString('base64');
  }

  private base64ToArrayBuffer(base64: string): Uint8Array {
    const binary =
      typeof atob !== 'undefined' ? atob(base64) : Buffer.from(base64, 'base64').toString('binary');
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}

/**
 * Data masking utilities
 */

/**
 * Mask email
 */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!(local && domain)) return email;

  const maskedLocal =
    local.length > 2
      ? local[0] + '*'.repeat(local.length - 2) + local[local.length - 1]
      : `${local[0]}*`;

  return `${maskedLocal}@${domain}`;
}

/**
 * Mask phone number
 */
function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return phone;

  const lastFour = digits.slice(-4);
  const masked = '*'.repeat(digits.length - 4) + lastFour;

  return phone.replace(/\d/g, (char, index) => {
    const digitIndex = phone.slice(0, index + 1).replace(/\D/g, '').length - 1;
    return masked[digitIndex] || char;
  });
}

/**
 * Mask credit card
 */
function maskCreditCard(card: string): string {
  const digits = card.replace(/\D/g, '');
  if (digits.length < 4) return card;

  const lastFour = digits.slice(-4);
  return `****-****-****-${lastFour}`;
}

/**
 * Mask SSN
 */
function maskSSN(ssn: string): string {
  const digits = ssn.replace(/\D/g, '');
  if (digits.length !== 9) return ssn;

  return `***-**-${digits.slice(-4)}`;
}

/**
 * Mask string (keep first and last character)
 */
function maskString(str: string, keepChars: number = 1): string {
  if (str.length <= keepChars * 2) {
    return '*'.repeat(str.length);
  }

  const prefix = str.slice(0, keepChars);
  const suffix = str.slice(-keepChars);
  const masked = '*'.repeat(str.length - keepChars * 2);

  return `${prefix}${masked}${suffix}`;
}

export const DataMasking = {
  maskEmail,
  maskPhone,
  maskCreditCard,
  maskSSN,
  maskString,
} as const;

/**
 * Secure random token generator
 */

/**
 * Generate secure token. `length` is the number of random bytes;
 * the returned string is hex-encoded, so it will be `length * 2` characters.
 */
function generateToken(length: number = 32): string {
  const bytes = encryption.randomBytes(length);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate UUID v4
 */
function generateUUID(): string {
  const crypto = globalThis.crypto;
  if (!crypto) {
    throw new Error('Crypto API not available');
  }

  return crypto.randomUUID();
}

/**
 * Generate API key
 */
function generateAPIKey(prefix: string = 'sk'): string {
  const token = generateToken(32);
  return `${prefix}_${token}`;
}

/**
 * Generate session ID
 */
function generateSessionID(): string {
  return generateToken(64);
}

export const TokenGenerator = {
  generate: generateToken,
  generateUUID,
  generateAPIKey,
  generateSessionID,
} as const;
