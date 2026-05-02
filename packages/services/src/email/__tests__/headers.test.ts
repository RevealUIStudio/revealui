import { describe, expect, it } from 'vitest';
import { encodeHeaderValue, sanitizeEmailHeader } from '../index';

describe('sanitizeEmailHeader', () => {
  it('strips CR and LF to block header injection', () => {
    expect(sanitizeEmailHeader('hello\r\nBcc: attacker@example.com')).toBe(
      'helloBcc: attacker@example.com',
    );
    expect(sanitizeEmailHeader('a\nb\rc')).toBe('abc');
  });

  it('passes pure ASCII through unchanged', () => {
    expect(sanitizeEmailHeader('Plain ASCII Subject')).toBe('Plain ASCII Subject');
  });
});

describe('encodeHeaderValue', () => {
  function decodeEncodedWord(encoded: string): string {
    const match = encoded.match(/^=\?UTF-8\?B\?(.+?)\?=$/);
    if (!match || match[1] === undefined) throw new Error(`not an encoded-word: ${encoded}`);
    const binary = atob(match[1]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }

  it('returns ASCII subjects unchanged (no unnecessary encoded-word wrap)', () => {
    expect(encodeHeaderValue('Plain ASCII Subject')).toBe('Plain ASCII Subject');
    expect(encodeHeaderValue('Hello, world! 1+2=3 (yes).')).toBe('Hello, world! 1+2=3 (yes).');
    expect(encodeHeaderValue('')).toBe('');
  });

  it('encodes em-dash subjects as RFC 2047 base64 encoded-word', () => {
    const subject = '[agency] CR7-01 post-Phase-0 verification — Claude Code';
    const encoded = encodeHeaderValue(subject);
    expect(encoded).toMatch(/^=\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=$/);
    expect(decodeEncodedWord(encoded)).toBe(subject);
  });

  it('encodes accented characters', () => {
    const subject = 'Bonjour, école ouverte — réponse en français';
    const encoded = encodeHeaderValue(subject);
    expect(encoded).toMatch(/^=\?UTF-8\?B\?/);
    expect(decodeEncodedWord(encoded)).toBe(subject);
  });

  it('encodes emoji', () => {
    const subject = 'Order received ✓ confirmed';
    const encoded = encodeHeaderValue(subject);
    expect(encoded).toMatch(/^=\?UTF-8\?B\?/);
    expect(decodeEncodedWord(encoded)).toBe(subject);
  });

  it('encodes a subject containing only non-ASCII', () => {
    const subject = '日本語の件名';
    const encoded = encodeHeaderValue(subject);
    expect(decodeEncodedWord(encoded)).toBe(subject);
  });

  it('strips CR/LF before encoding so injected headers cannot escape the encoded-word', () => {
    const malicious = 'Subject — legit\r\nBcc: attacker@example.com';
    const encoded = encodeHeaderValue(malicious);
    expect(encoded).toMatch(/^=\?UTF-8\?B\?/);
    const decoded = decodeEncodedWord(encoded);
    expect(decoded).toBe('Subject — legitBcc: attacker@example.com');
    expect(decoded).not.toContain('\r');
    expect(decoded).not.toContain('\n');
  });

  it('handles a non-ASCII char at the very last byte', () => {
    const subject = 'trailing em-dash —';
    const encoded = encodeHeaderValue(subject);
    expect(decodeEncodedWord(encoded)).toBe(subject);
  });
});
