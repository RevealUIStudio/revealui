function toHex(bytes: Uint8Array): string {
  let hex = '';
  for (const b of bytes) {
    hex += b.toString(16).padStart(2, '0');
  }
  return hex;
}

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    const hi = hex.charCodeAt(i);
    const lo = hex.charCodeAt(i + 1);
    const hiVal =
      hi >= 48 && hi <= 57
        ? hi - 48
        : hi >= 97 && hi <= 102
          ? hi - 87
          : hi >= 65 && hi <= 70
            ? hi - 55
            : -1;
    const loVal =
      lo >= 48 && lo <= 57
        ? lo - 48
        : lo >= 97 && lo <= 102
          ? lo - 87
          : lo >= 65 && lo <= 70
            ? lo - 55
            : -1;
    if (hiVal === -1 || loVal === -1) return null;
    bytes[i / 2] = (hiVal << 4) | loVal;
  }
  return bytes;
}

async function importKey(secret: string, usage: 'sign' | 'verify'): Promise<CryptoKey> {
  const encoded = new TextEncoder().encode(secret);
  return crypto.subtle.importKey('raw', encoded, { name: 'HMAC', hash: 'SHA-256' }, false, [usage]);
}

export async function generateCsrfToken(sessionBinding: string, secret: string): Promise<string> {
  const nonce = crypto.getRandomValues(new Uint8Array(16));
  const nonceHex = toHex(nonce);
  const key = await importKey(secret, 'sign');
  const data = new TextEncoder().encode(`${sessionBinding}:${nonceHex}`);
  const sig = await crypto.subtle.sign('HMAC', key, data);
  const hmacHex = toHex(new Uint8Array(sig));
  return `${nonceHex}:${hmacHex}`;
}

export async function validateCsrfToken(
  token: string,
  sessionBinding: string,
  secret: string,
): Promise<boolean> {
  const colonIdx = token.indexOf(':');
  if (colonIdx === -1) return false;
  const nonce = token.slice(0, colonIdx);
  const providedHmac = token.slice(colonIdx + 1);
  if (!(nonce && providedHmac)) return false;
  if (providedHmac.indexOf(':') !== -1) return false;

  const sigBytes = hexToBytes(providedHmac);
  if (!sigBytes) return false;

  const key = await importKey(secret, 'verify');
  const data = new TextEncoder().encode(`${sessionBinding}:${nonce}`);

  try {
    return await crypto.subtle.verify('HMAC', key, sigBytes, data);
  } catch {
    return false;
  }
}
