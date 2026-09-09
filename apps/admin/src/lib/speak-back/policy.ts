import { redactSecretsInString } from '@revealui/security';
import type { SpeechAdapter } from './adapter';

export type SpeakBackReason = 'spoken' | 'disabled' | 'empty' | 'secret';

export interface SpeakBackRequest {
  text: string;
  enabled: boolean;
}

export interface SpeakBackResult {
  spoken: boolean;
  reason: SpeakBackReason;
}

const TOKEN_SEPARATORS = new Set([
  ' ',
  '\n',
  '\t',
  '\r',
  ',',
  ';',
  '"',
  "'",
  '`',
  '(',
  ')',
  '[',
  ']',
  '{',
  '}',
  '<',
  '>',
  '|',
]);

const REVEAL_LICENSE_PREFIXES = ['RVUI-', 'rvui-'] as const;
const REVEAL_LICENSE_HEX_LENGTH = 32;

function isHexChar(ch: string): boolean {
  const lower = ch.toLowerCase();
  return (lower >= '0' && lower <= '9') || (lower >= 'a' && lower <= 'f');
}

function isHex(value: string): boolean {
  if (value.length === 0) return false;
  for (const ch of value) {
    if (!isHexChar(ch)) return false;
  }
  return true;
}

function tokenize(text: string): string[] {
  const tokens: string[] = [];
  let current = '';
  for (const ch of text) {
    if (TOKEN_SEPARATORS.has(ch)) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }
  if (current.length > 0) tokens.push(current);
  return tokens;
}

function looksLikeRevealLicenseKey(token: string): boolean {
  for (const prefix of REVEAL_LICENSE_PREFIXES) {
    if (!token.startsWith(prefix)) continue;
    const rest = token.slice(prefix.length);
    const dash = rest.indexOf('-');
    if (dash <= 0) return false;
    const hex = rest.slice(dash + 1);
    return hex.length === REVEAL_LICENSE_HEX_LENGTH && isHex(hex);
  }
  return false;
}

/** True when the reply contains a license key, token, or other secret shape. */
export function containsSecretShapedText(text: string): boolean {
  if (redactSecretsInString(text) !== text) return true;
  for (const token of tokenize(text)) {
    if (looksLikeRevealLicenseKey(token)) return true;
  }
  return false;
}

/**
 * Speak the agent's own reply text. Never sends the reply to a second model.
 * Off unless `enabled` is true. Refuses secret-shaped text.
 */
export function requestSpeakBack(
  request: SpeakBackRequest,
  adapter: SpeechAdapter,
): SpeakBackResult {
  if (!request.enabled) {
    return { spoken: false, reason: 'disabled' };
  }

  const text = request.text.trim();
  if (text.length === 0) {
    return { spoken: false, reason: 'empty' };
  }

  if (containsSecretShapedText(request.text)) {
    return { spoken: false, reason: 'secret' };
  }

  adapter.speak(text);
  return { spoken: true, reason: 'spoken' };
}
