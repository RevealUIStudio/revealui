---
'@revealui/security': minor
---

Remove deprecated `PasswordHasher` (PBKDF2) from `@revealui/security`.

**Why:** PBKDF2 is less resistant to GPU brute-force attacks than bcrypt. `@revealui/auth` has shipped bcrypt-based password hashing (12 rounds) as the canonical implementation for several releases, and `@revealui/security`'s `PasswordHasher` has been marked `@deprecated` since its introduction. No internal callers remain in this monorepo.

**Migration:** Replace `PasswordHasher` from `@revealui/security` with the bcrypt-based utilities exported from `@revealui/auth`.

```ts
// Before
import { PasswordHasher } from '@revealui/security';
const hash = await PasswordHasher.hash(password);
const ok = await PasswordHasher.verify(password, hash);

// After
import { hashPassword, verifyPassword } from '@revealui/auth';
const hash = await hashPassword(password);
const ok = await verifyPassword(password, hash);
```

Hashes produced by the old PBKDF2 implementation (`salt:hash` hex format) are not verifiable by bcrypt and must be re-hashed at next login. If you have production users with PBKDF2 hashes, detect the format on login (`hash.includes(':')`) and re-hash with bcrypt after successful PBKDF2 verification.
