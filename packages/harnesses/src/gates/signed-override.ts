/** GAP-313: one owner SSHSIG door shared by server-side gates. */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const OWNER_OVERRIDE_NAMESPACE = 'revealfleet-override';
export const OWNER_OVERRIDE_IDENTITY = 'owner@revealui.com';
export const OWNER_OVERRIDE_BEGIN = 'REVEALFLEET-OVERRIDE-BEGIN';
export const OWNER_OVERRIDE_END = 'REVEALFLEET-OVERRIDE-END';

export interface OwnerOverrideContext {
  repo: string;
  pr: number;
  head: string;
  gate: string;
}
export interface OwnerOverrideComment {
  body: string;
  url?: string;
}
export interface OwnerOverrideResult {
  ok: boolean;
  reason?: string;
  url?: string;
}

function token(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= 200 &&
    [...value].every(
      (c) =>
        (c >= 'a' && c <= 'z') ||
        (c >= 'A' && c <= 'Z') ||
        (c >= '0' && c <= '9') ||
        '-_./'.includes(c),
    )
  );
}
function validContext(context: OwnerOverrideContext): boolean {
  return (
    token(context.repo) &&
    context.repo.split('/').length === 2 &&
    context.repo.split('/').every((part) => part.length > 0) &&
    Number.isSafeInteger(context.pr) &&
    context.pr > 0 &&
    token(context.gate) &&
    context.head.length === 40 &&
    [...context.head].every((c) => (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'))
  );
}
function validDate(value: string): boolean {
  if (value.length !== 10 || value[4] !== '-' || value[7] !== '-') return false;
  for (let i = 0; i < value.length; i++) {
    const character = value.charAt(i);
    if (i !== 4 && i !== 7 && !(character >= '0' && character <= '9')) return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Exact bytes handed to the owner's external ssh-keygen -Y sign command. */
export function buildOwnerOverridePayload(context: OwnerOverrideContext, expires: string): string {
  if (!(validContext(context) && validDate(expires)))
    throw new Error('Invalid owner override context or expiry');
  return `revealfleet-override v1 repo=${context.repo} pr=${context.pr} head=${context.head} gate=${context.gate} expires=${expires}\n`;
}

/** Wrap externally produced SSHSIG bytes; never signs or reads a private key. */
export function buildOwnerOverrideComment(payload: string, signature: string): string {
  const normalized = signature.replaceAll('\r\n', '\n').trim();
  if (
    !payload.endsWith('\n') ||
    payload.slice(0, -1).includes('\n') ||
    !normalized.startsWith('-----BEGIN SSH SIGNATURE-----\n') ||
    !normalized.endsWith('\n-----END SSH SIGNATURE-----')
  )
    throw new Error('Invalid override envelope');
  return `${OWNER_OVERRIDE_BEGIN}\n${payload}${normalized}\n${OWNER_OVERRIDE_END}\n`;
}

/** Comments are untrusted transport, supplied oldest first (GitHub API order). */
export function verifyOwnerOverrideComments(input: {
  comments: readonly OwnerOverrideComment[];
  allowedSigners: string;
  expected: OwnerOverrideContext;
  now?: Date;
}): OwnerOverrideResult {
  if (!input.allowedSigners.trim()) return { ok: false, reason: 'missing-owner-anchor' };
  if (input.allowedSigners.length > 65536 || !validContext(input.expected))
    return { ok: false, reason: 'invalid-context-or-anchor' };
  const now = input.now ?? new Date();
  if (!Number.isFinite(now.getTime())) return { ok: false, reason: 'invalid-clock' };
  if (input.comments.length > 1000) return { ok: false, reason: 'owner-comment-limit' };
  let reason = 'missing-owner-signature';
  let attempts = 0;
  for (const comment of [...input.comments].reverse()) {
    if (comment.body.length > 65536) continue;
    const lines = comment.body.replaceAll('\r\n', '\n').split('\n');
    for (let start = lines.length - 1; start >= 0; start--) {
      if (lines[start] !== OWNER_OVERRIDE_BEGIN) continue;
      const end = lines.indexOf(OWNER_OVERRIDE_END, start + 1);
      if (end < 0 || end - start > 128) {
        reason = 'malformed-owner-signature';
        continue;
      }
      const line = lines[start + 1] ?? '';
      const expires = line.slice(-10);
      if (!validDate(expires)) {
        reason = 'invalid-expiry';
        continue;
      }
      const payload = buildOwnerOverridePayload(input.expected, expires);
      if (`${line}\n` !== payload) {
        reason = 'wrong-context';
        continue;
      }
      if (expires <= now.toISOString().slice(0, 10)) {
        reason = 'expired';
        continue;
      }
      const signature = lines.slice(start + 2, end).join('\n');
      if (
        !(
          signature.startsWith('-----BEGIN SSH SIGNATURE-----\n') &&
          signature.endsWith('\n-----END SSH SIGNATURE-----')
        )
      ) {
        reason = 'malformed-owner-signature';
        continue;
      }
      if (++attempts > 32) return { ok: false, reason: 'owner-verification-limit' };
      const directory = mkdtempSync(join(tmpdir(), 'revealfleet-owner-verify-'));
      try {
        const signers = join(directory, 'allowed-signers');
        const sig = join(directory, 'signature');
        writeFileSync(signers, input.allowedSigners, { mode: 0o600 });
        writeFileSync(sig, `${signature}\n`, { mode: 0o600 });
        const verification = spawnSync(
          'ssh-keygen',
          [
            '-Y',
            'verify',
            '-f',
            signers,
            '-I',
            OWNER_OVERRIDE_IDENTITY,
            '-n',
            OWNER_OVERRIDE_NAMESPACE,
            '-s',
            sig,
          ],
          { input: payload, encoding: 'utf8', timeout: 5000, maxBuffer: 65536 },
        );
        if (!verification.error && verification.status === 0) {
          return { ok: true, ...(comment.url ? { url: comment.url } : {}) };
        }
        reason = verification.error ? 'owner-verifier-unavailable' : 'bad-owner-signature';
      } catch {
        reason = 'owner-verifier-unavailable';
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    }
  }
  return { ok: false, reason };
}
