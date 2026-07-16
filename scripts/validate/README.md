---
title: "Validation Scripts"
description: "Index of the pass/fail validation gates that keep code, docs, and config honest."
visibility: internal
status: verified
audience: contributor
---

# Validation Scripts

`scripts/validate/` holds the pass/fail gates that catch drift between the code,
the docs, and the configuration. Each validator exits non-zero on failure and
most are surfaced as a root `package.json` alias. Many are wired into
`pnpm gate` (see [../gates](../gates)); all can be run standalone.

## Usage

```bash
pnpm validate:boundary       # Package boundary enforcement
pnpm validate:claims         # Claim-drift validation
pnpm validate:doc-currency   # Documentation currency check
pnpm preflight               # Full pre-launch checklist (scripts/validate/pre-launch.ts)
```

To run one directly:

```bash
tsx scripts/validate/boundary.ts
```

## Validator Index

### Code Structure & Boundaries

| Validator            | Command                | Purpose                                          |
| -------------------- | ---------------------- | ------------------------------------------------ |
| `boundary.ts`        | `pnpm validate:boundary` | Enforce package import boundaries              |
| `structure.ts`       | `pnpm validate:structure`| Enforce project structure                      |
| `build-artifacts.ts` | `pnpm validate:artifacts`| Validate build artifacts                       |
| `react-rsc-floor.ts` | `pnpm validate:react-floor` | Enforce the React Server Component floor    |
| `validate-code.ts`   | run via `tsx`          | Validate code files against RevealUI standards   |
| `validate-root-markdown.ts` | run via `tsx`   | Enforce which `.md` files may live in the repo root |

### Documentation & Claims

| Validator            | Command                     | Purpose                                       |
| -------------------- | --------------------------- | --------------------------------------------- |
| `claim-drift.ts`     | `pnpm validate:claims`      | Detect drift between doc claims and code      |
| `claims-evidence.ts` | `pnpm validate:claims-evidence` | Verify claims are backed by evidence      |
| `doc-currency.ts`    | `pnpm validate:doc-currency`| Flag stale, dated facts in docs               |
| `docs-import-drift.ts` | `pnpm validate:docs-imports` | Detect drifted import examples in docs      |
| `citation-check.ts`  | `pnpm validate:citations`   | Verify `file:line` source citations resolve   |

Documentation link checking runs separately via `pnpm --filter docs check:links`
(`apps/docs/scripts/check-links.ts`) and is part of the CI `quality` job.

### Code Quality

| Validator            | Command                    | Purpose                                        |
| -------------------- | -------------------------- | ---------------------------------------------- |
| `empty-catch.ts`     | `pnpm validate:empty-catch`| Flag silent empty catch blocks                 |
| `raw-sql.ts`         | `pnpm validate:raw-sql`    | Flag raw SQL outside allowlisted paths         |
| `as-never-values.ts` | `pnpm validate:as-never-values` | Flag `as never` value assertions          |
| `stripe-client.ts`   | `pnpm validate:stripe-client` | Enforce Stripe client-safety boundaries     |
| `client-safety.ts`   | `pnpm validate:client-safety` | Flag server-only code leaking to the client |

### Brand & Marketing

| Validator               | Command                       | Purpose                                |
| ----------------------- | ----------------------------- | -------------------------------------- |
| `marketing-voice.ts`    | `pnpm validate:marketing-voice` | Enforce marketing voice rules        |
| `brand-bridge.ts`       | `pnpm validate:brand-bridge`  | Validate the brand-token bridge        |
| `design-context-drift.ts` | `pnpm validate:design-context` | Detect design-context drift          |

### Versioning, Migrations & Env

| Validator                | Command                        | Purpose                                    |
| ------------------------ | ------------------------------ | ------------------------------------------ |
| `version-policy.ts`      | `pnpm validate:versions`       | Enforce the versioning policy              |
| `migration-journal.ts`   | `pnpm validate:migrations`     | Verify migration journal integrity         |
| `catalog-changeset.ts`   | `pnpm validate:catalog`        | Check the changeset catalog (warn)         |
| `mixed-changesets.ts`    | `pnpm validate:changesets`     | Flag mixed OSS/Pro changesets              |
| `changelog-format.ts`    | `pnpm validate:changelogs`     | Enforce changelog format                   |
| `pricing-lockstep.ts`    | `pnpm validate:pricing-lockstep` | Keep pricing sources in lockstep         |
| `prod-env.ts`            | `pnpm validate:prod-env`       | Validate production env configuration      |
| `gitignore-pro.ts`       | `pnpm validate:gitignore`      | Enforce Pro-package gitignore policy       |
| `seed-script-wiring.ts`  | `pnpm validate:seed-wiring`    | Verify seed scripts are wired correctly    |

### Pre-launch

| Validator       | Command         | Purpose                                    |
| --------------- | --------------- | ------------------------------------------ |
| `pre-launch.ts` | `pnpm preflight`| Run the full pre-launch checklist          |

### Security-review gate

`security-review-gate.cjs` is invoked by the `.github/workflows/security-review-gate.yml`
workflow (not a `pnpm` alias). It reads sensitive-path changes and PR labels to
decide whether a security review is required before merge.

## Related validators outside this directory

Some `validate:*` aliases point at tests elsewhere in `scripts/`:

- `pnpm validate:secret-paths`, `scripts/sync/__tests__/secret-paths-lockstep.test.ts`
- `pnpm validate:kek-rotation`, `scripts/security/__tests__/rotate-kek.test.ts`

## Adding a Validator

1. Add `scripts/validate/<name>.ts` that exits non-zero on failure.
2. Add a `validate:<name>` alias to the root `package.json`.
3. Wire it into `scripts/gates/ci-gate.ts` if it should block `pnpm gate`.
4. Add it to the index above.

## Related

- [Gates](../gates), the CI gate orchestration that runs many of these
- [Main Scripts README](../README.md)
