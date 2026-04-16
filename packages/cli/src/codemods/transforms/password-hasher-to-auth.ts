/**
 * Codemod: PasswordHasher (PBKDF2) from @revealui/security → bcrypt-based
 * hashPassword / verifyPassword from @revealui/auth.
 *
 * Shipped alongside @revealui/security 0.3.0 which drops the deprecated
 * `PasswordHasher` export. See CHANGELOG and .changeset/remove-password-hasher.md.
 *
 * Scope: rewrites imports and call sites. Users with PBKDF2 hashes stored
 * in their database must handle the hash-format migration themselves
 * (detect `:` separator, re-hash after successful PBKDF2 verification);
 * that can't be done by a source transform.
 */

import type { Codemod, CodemodApi } from '../types.js';

const IMPORT_RE = /import\s+\{([^}]*)\}\s+from\s+(['"])@revealui\/security\2/g;
const CALL_HASH_RE = /\bPasswordHasher\s*\.\s*hash\s*\(/g;
const CALL_VERIFY_RE = /\bPasswordHasher\s*\.\s*verify\s*\(/g;
const USES_PASSWORD_HASHER_RE = /\bPasswordHasher\b/;

function rewriteImports(source: string): { source: string; didImport: boolean } {
  let didImport = false;
  const rewritten = source.replace(IMPORT_RE, (match, specifiers: string, quote: string) => {
    // Parse named imports: "{ A, B, PasswordHasher, C as D }"
    const items = specifiers
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const keep: string[] = [];
    let removedPasswordHasher = false;
    for (const item of items) {
      // `PasswordHasher` or `PasswordHasher as X` — drop either form.
      if (/^PasswordHasher(\s+as\s+\w+)?$/.test(item)) {
        removedPasswordHasher = true;
        continue;
      }
      keep.push(item);
    }

    if (!removedPasswordHasher) return match;
    didImport = true;

    const securityLine =
      keep.length > 0
        ? `import { ${keep.join(', ')} } from ${quote}@revealui/security${quote}`
        : null;
    const authLine = `import { hashPassword, verifyPassword } from ${quote}@revealui/auth${quote}`;

    return securityLine ? `${securityLine};\n${authLine}` : authLine;
  });

  return { source: rewritten, didImport };
}

function rewriteCallSites(source: string): { source: string; didCall: boolean } {
  let didCall = false;
  let out = source.replace(CALL_HASH_RE, () => {
    didCall = true;
    return 'hashPassword(';
  });
  out = out.replace(CALL_VERIFY_RE, () => {
    didCall = true;
    return 'verifyPassword(';
  });
  return { source: out, didCall };
}

function transform(source: string, _api: CodemodApi): string | null {
  if (!USES_PASSWORD_HASHER_RE.test(source)) return null;

  const afterImports = rewriteImports(source);
  const afterCalls = rewriteCallSites(afterImports.source);

  if (!(afterImports.didImport || afterCalls.didCall)) return null;
  return afterCalls.source;
}

export const passwordHasherToAuth: Codemod = {
  name: 'password-hasher-to-auth',
  description:
    'Migrate PasswordHasher (PBKDF2) from @revealui/security to bcrypt-based hashPassword/verifyPassword from @revealui/auth',
  package: '@revealui/security',
  fromVersion: '<0.3.0',
  toVersion: '>=0.3.0',
  match(filePath) {
    return /\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(filePath);
  },
  transform,
};
