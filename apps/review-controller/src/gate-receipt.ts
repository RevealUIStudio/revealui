import { createHash, createPrivateKey, createPublicKey, sign } from 'node:crypto';

const GATE_ID = 'sec-review';
const SIGNER_IDENTITY = 'owner@revealui.com';
const SIGNATURE_NAMESPACE = 'revealfleet-override';
const OVERRIDE_BEGIN = 'REVEALFLEET-OVERRIDE-BEGIN';
const OVERRIDE_END = 'REVEALFLEET-OVERRIDE-END';
const DAY_MS = 86_400_000;

export interface GateReceiptObject {
  path: string;
  body: string;
  allowedSigners: string;
  expires: string;
}

/** Shortest UTC date the receipt-only gate will still load. */
export function gateReceiptExpiryDate(expiresAt: Date, now: Date): string {
  if (!(Number.isFinite(expiresAt.getTime()) && Number.isFinite(now.getTime())))
    throw new Error('invalid_gate_receipt_expiry');
  if (expiresAt.getTime() <= now.getTime()) throw new Error('gate_receipt_expired');
  const today = now.toISOString().slice(0, 10);
  const receiptDay = expiresAt.toISOString().slice(0, 10);
  if (receiptDay > today) return receiptDay;
  return new Date(Date.parse(`${today}T00:00:00.000Z`) + DAY_MS).toISOString().slice(0, 10);
}

export function gateReceiptObjectPath(
  repositoryFullName: string,
  pullRequest: number,
  head: string,
): string {
  if (!(validRepo(repositoryFullName) && validPullRequest(pullRequest) && validHead(head)))
    throw new Error('invalid_gate_receipt_context');
  const slash = repositoryFullName.indexOf('/');
  return [
    'receipts',
    repositoryFullName.slice(0, slash),
    repositoryFullName.slice(slash + 1),
    String(pullRequest),
    head,
  ].join('/');
}

/** Sign the exact envelope the review gate loads for this pull request head. */
export function signGateReceipt(input: {
  repositoryFullName: string;
  pullRequest: number;
  head: string;
  expiresAt: Date;
  privateKeyPem: string;
  now?: Date;
}): GateReceiptObject {
  const now = input.now ?? new Date();
  const expires = gateReceiptExpiryDate(input.expiresAt, now);
  const path = gateReceiptObjectPath(input.repositoryFullName, input.pullRequest, input.head);
  const payload = `revealfleet-override v1 repo=${input.repositoryFullName} pr=${input.pullRequest} head=${input.head} gate=${GATE_ID} expires=${expires}\n`;
  const privateKey = createPrivateKey(input.privateKeyPem);
  if (privateKey.asymmetricKeyType !== 'ed25519')
    throw new Error('gate_receipt_key_must_be_ed25519');
  const publicKey = createPublicKey(privateKey);
  const jwk = publicKey.export({ format: 'jwk' });
  if (jwk.kty !== 'OKP' || jwk.crv !== 'Ed25519' || typeof jwk.x !== 'string')
    throw new Error('gate_receipt_public_key_unavailable');
  const rawPublic = Buffer.from(jwk.x, 'base64url');
  const publicBlob = Buffer.concat([sshString('ssh-ed25519'), sshString(rawPublic)]);
  const hash = createHash('sha512').update(payload).digest();
  const signed = Buffer.concat([
    Buffer.from('SSHSIG'),
    sshString(SIGNATURE_NAMESPACE),
    sshString(''),
    sshString('sha512'),
    sshString(hash),
  ]);
  const rawSignature = sign(null, signed, privateKey);
  const signatureBlob = Buffer.concat([sshString('ssh-ed25519'), sshString(rawSignature)]);
  const packed = Buffer.concat([
    Buffer.from('SSHSIG'),
    uint32(1),
    sshString(publicBlob),
    sshString(SIGNATURE_NAMESPACE),
    sshString(''),
    sshString('sha512'),
    sshString(signatureBlob),
  ]);
  const signature = armorSignature(packed);
  return {
    path,
    body: `${OVERRIDE_BEGIN}\n${payload}${signature}\n${OVERRIDE_END}\n`,
    allowedSigners: `${SIGNER_IDENTITY} ssh-ed25519 ${publicBlob.toString('base64')}\n`,
    expires,
  };
}

function armorSignature(packed: Buffer): string {
  const encoded = packed.toString('base64');
  const lines: string[] = [];
  for (let index = 0; index < encoded.length; index += 70)
    lines.push(encoded.slice(index, index + 70));
  return `-----BEGIN SSH SIGNATURE-----\n${lines.join('\n')}\n-----END SSH SIGNATURE-----`;
}

function sshString(value: string | Buffer): Buffer {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return Buffer.concat([uint32(bytes.length), bytes]);
}

function uint32(value: number): Buffer {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32BE(value);
  return bytes;
}

function validPullRequest(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function validHead(value: string): boolean {
  if (value.length !== 40) return false;
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    const digit = code >= 48 && code <= 57;
    const lower = code >= 97 && code <= 102;
    if (!(digit || lower)) return false;
  }
  return true;
}

function validRepo(value: string): boolean {
  if (!validToken(value, 200)) return false;
  const slash = value.indexOf('/');
  return slash > 0 && slash === value.lastIndexOf('/') && slash < value.length - 1;
}

export function validGateReceiptRef(value: string): boolean {
  return validToken(value, 200) && !value.includes('?');
}

function validToken(value: string, max: number): boolean {
  if (value.length === 0 || value.length > max || value.includes('..')) return false;
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    const digit = code >= 48 && code <= 57;
    const upper = code >= 65 && code <= 90;
    const lower = code >= 97 && code <= 122;
    if (!(digit || upper || lower || '-_./'.includes(character))) return false;
  }
  return true;
}
