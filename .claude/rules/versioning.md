# Versioning Convention

**Wrapper only.** SSOT is `.revealui/content/rules/versioning.md` (generated from `@revealui/harnesses` `versioning` rule). Do not author policy in this file.

- 0.x until real external consumers + stable contract (M6).
- Named 1.x exception: `@revealui/ai`.
- Private packages never 1.0-publish.
- Publish: OIDC `release.yml` on `main`. First 404 name is owner 2FA once (GAP-498).
