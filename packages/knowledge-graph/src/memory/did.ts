import { createHash } from 'node:crypto';

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const AGENT_ID_CHARS = new Set('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-');

function sanitizeAgentIdPart(raw: string): string {
  const mapped = Array.from(raw)
    .map((c) => (AGENT_ID_CHARS.has(c) ? c : '_'))
    .join('');
  return mapped.length > 0 ? mapped.slice(0, 64) : 'user';
}

function base58Encode(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros += 1;
  const size = Math.ceil((bytes.length * 138) / 100) + 1;
  const encoded = new Uint8Array(size);
  let length = 0;
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i] ?? 0;
    let j = 0;
    for (let k = encoded.length - 1; k >= 0 && (carry !== 0 || j < length); k--, j++) {
      carry += 256 * (encoded[k] ?? 0);
      encoded[k] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    length = j;
  }
  let start = encoded.length - length;
  while (start < encoded.length && encoded[start] === 0) start += 1;
  let out = '1'.repeat(zeros);
  for (let i = start; i < encoded.length; i++) {
    out += BASE58[encoded[i] ?? 0];
  }
  return out;
}

/**
 * HTTP v1 fallback DID. Client cannot pick this string.
 * `did:revfleet:user_{sanitizedUserId}:{base58(sha256(mcp-v1:userId:accountId)).slice(0,32)}`
 */
export function httpFallbackDid(
  userId: string,
  accountId: string,
): { did: string; agentId: string; fingerprint: string; didKind: 'user-account-fallback' } {
  const agentId = `user_${sanitizeAgentIdPart(userId)}`;
  const digest = createHash('sha256').update(`mcp-v1:${userId}:${accountId}`, 'utf8').digest();
  const fingerprint = base58Encode(digest).slice(0, 32);
  return {
    did: `did:revfleet:${agentId}:${fingerprint}`,
    agentId,
    fingerprint,
    didKind: 'user-account-fallback',
  };
}
