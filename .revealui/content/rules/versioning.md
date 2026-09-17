# SemVer and 1.0 contract (M6)

**SSOT:** `.revealui/content/rules/versioning.md` (this file, generated from `@revealui/harnesses`).
Adapter copies under `.claude/rules/` or `.grok/rules/` must be **wrappers** that point here. Do not author a second dialect.

## Rule

- Every new versioned artifact starts at `0.1.0`.
- Inside `0.x`: breaking / meaningful behavior = **minor**; bugfix = **patch**. Never bump major inside `0.x`.
- `1.0.0` is a public contract claim ("consumers can depend on this API without handholding"). It requires **real external consumers** and a **stable contract across at least one release cycle**.
- After `1.0.0`: SemVer 2.0.0 (patch / minor / major).
- MASTER_PLAN Bucket 3 (cadence-relax) still requires RevealUI Platform 1.0.0 **and** 3 months of Studio profitability. Package 1.0 is not that gate.

## Three sets (GAP-497)

| Set | Policy |
|-----|--------|
| **Landed 1.x** | `@revealui/ai` 1.0.4 (FSL). Named exception — not a waiver for the rest. |
| **Stay 0.x until consumers+stability** | All other **public** `@revealui/*` and `create-revealui`. ROADMAP: no external paying customers yet → verdict is **blocked-on**, not ready. |
| **Never 1.0-publish** | `private: true` workspace packages and apps (not npm). Also sibling repos that are not npm libraries. |

Per-package and sibling-repo one-line verdicts live in `.jv` GAP-497 YAML (TRACKER). Do not bump `1.0.0` in the same change as an inventory-only PR.

## Publish (see also `npm-oidc-publish`)

1. Changeset on the working branch. Merge to `test`.
2. Promote `test` → `main` (head **is** `test`).
3. **Existing names:** GitHub Actions `release.yml` on `main`, OIDC, environment `npm-publish`. Agents never `npm login` / GAT / local publish.
4. **New names (404 on the registry):** OIDC cannot create them. Owner interactive 2FA first-publish once, then attach the trusted publisher. Same bootstrap as GAP-380 / GAP-498.

Canary (`release-canary.yml`) is **decommissioned**. Do not document it as a live path.

## Changesets ignore

Must include every `private: true` app/package that must never publish: `server`, `admin`, `docs`, `marketing`, `@revealui/test`, `@revealui/scripts`, `@revealui/dev`, plus `@revealui/engines`, `@revealui/apify-actor-governed-run`, `revealui`, `@revealui/ts-strada`, `@revealui/license-signer`, `@rsc-poc/app`. Pro **public** packages (ai, harnesses, mcp, services) stay on the changesets pipeline (Fair Source).
