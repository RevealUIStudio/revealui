# ADR-003: Fair Source Licensing (FSL-1.1-MIT)

**Date:** 2026-04-08
**Status:** Accepted

## Context

RevealUI has two classes of packages: OSS (core infrastructure) and Pro (AI agents, harnesses). The business model requires Pro packages to be commercially protected while remaining source-visible for trust and auditability. The previous model gitignored Pro packages in the public repo and archived them in a private repo — this created sync friction, confused contributors, and made CI harder.

## Decision

Adopt the **Functional Source License 1.1 (FSL-1.1-MIT)** for Pro packages:

- **OSS packages** (20+): MIT license. Fully open.
- **Pro packages** (ai, harnesses): FSL-1.1-MIT. Source-visible, non-compete clause, automatically converts to MIT after 2 years.

All source code lives in the public repo. No gitignored packages. No private repo sync.

### Runtime enforcement

Pro features are gated at runtime, not at the source level:
- JWT RS256 license validation (`initializeLicense()`)
- 6-layer middleware: tier check, feature check, AI access check, domain lock, revocation check, support expiry
- `checkAIFeatureGate()` at every Pro API entry point
- License tiers: `free | pro | max | enterprise`

### Precedent

FSL-1.1 is used by Sentry, GitButler, and Keygen. It's OSI-approved after the 2-year conversion window.

## Alternatives Considered

- **Gitignored Pro packages**: Previous model. Created sync problems, broke contributor experience, required a private archive repo.
- **BSL (Business Source License)**: MariaDB's license. More restrictive, less well-known in the JS ecosystem. 4-year conversion period.
- **SSPL**: MongoDB's license. Too restrictive — effectively prevents any cloud hosting.
- **Dual MIT + Commercial**: Requires CLA for contributions. FSL avoids this.

## Consequences

- Pro source code is publicly readable (good for trust, bad for copy-paste competitors)
- Runtime enforcement is the real protection — the license is legal backstop
- The changeset config must be updated to include Pro packages in the normal release flow
- `LICENSE.FSL` file at repo root describes the Fair Source terms
