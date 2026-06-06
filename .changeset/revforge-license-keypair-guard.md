---
"@revealui/core": patch
---

Fail closed when a RevForge license is issued with a private/public pair that is not a matching Ed25519 keypair. `issueRevForgeLicense` now verifies the freshly-signed JWT against the supplied public key (reusing the runtime verifier) and throws `REVFORGE_LICENSE_KEYPAIR_MISMATCH` on failure, so a stamped kit can no longer bake a public key that cannot verify its own license and crash-loop at boot.
