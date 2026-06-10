---
title: "ADR: Deployment Target — Vercel + Forge Docker, not Kubernetes"
description: "**Date:** 2026-05-08"
visibility: public
status: verified
audience: user
---

**Date:** 2026-05-08
**Status:** Decided — final
**Phase:** 5 — Agent-First Infrastructure
**Audit:** [`docs/audits/2026-05-08-fleet-doc-quality-audit.md`](https://github.com/RevealUIStudio/revealui-jv) (revealui-jv repo, commit `e0a59018c`)
**Companion PR:** [revealui#782](https://github.com/RevealUIStudio/revealui/pull/782) — folds the doc-quality `CI_CD_GUIDE.md` shrink with the dead-infra deletion this ADR documents.

## Context

The fleet doc-quality audit (Phase 4 sweep over `docs/CI_CD_GUIDE.md`, 2,941 → 432 lines, −85%) surfaced a substantial body of Kubernetes/Helm/kubectl scaffolding on disk that the documentation referenced but no production system used. The audit cut the documentation; this ADR + the companion PR cut the scaffolding too.

Inventory of what existed:

- `infrastructure/k8s/` — namespace, ingress, postgres statefulset, admin + dashboard deployments, secrets template
- `scripts/deploy.sh` + `scripts/rollback.sh` — kubectl-based, referencing `docker/Dockerfile.{admin,dashboard}` paths that did not exist (actual paths are `apps/<app>/Dockerfile.forge`)
- `infrastructure/docker-compose/production.yml` — superseded by root `docker-compose.forge.yml`
- `infrastructure/scripts/deployment/staging-deploy.sh` — superseded by `deploy-test.yml` (`workflow_dispatch`)
- `infrastructure/docker/Dockerfile.base`, `Dockerfile.admin` — zero references; per-app `Dockerfile.forge` is the live path
- `infrastructure/docker/nginx/`, `infrastructure/docker/prometheus/` — zero references; HTTPS termination + observability not part of any active stack

None of these were wired into [`.github/workflows/`](../../.github/workflows/), `package.json` scripts, `turbo.json`, any cross-fleet repo (`revealui-jv`, `revcon`, `revdev`), or `docker-compose.{yml,forge.yml}` (the only refs were commented-out nginx volume mounts removed alongside this ADR).

## Decision

RevealUI has two deployment paths. Kubernetes is not one of them.

| Path | Workflow | Surface |
|------|----------|---------|
| Hosted SaaS | [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml) — Vercel CLI, per-app project IDs, validate → migrate → matrix-deploy → smoke → auto-rollback | 4 apps: `api`, `admin`, `marketing`, `docs` |
| Self-hosted enterprise (Forge) | [`.github/workflows/docker.yml`](../../.github/workflows/docker.yml) — builds `apps/{server,admin}/Dockerfile.forge`, pushes to `ghcr.io/revealuistudio` | Customers run [`docker-compose.forge.yml`](../../docker-compose.forge.yml) with their own license key |

The Forge stack handles its own reverse-proxy / TLS / observability concerns at the customer's deployment perimeter — RevealUI does not ship nginx configs, prometheus configs, or kubectl manifests.

## Why this is final (not "deferred until we need k8s")

The previous posture — "leave the scaffolding around in case we pivot to Kubernetes" — was the active failure mode. Each maintainer who discovered the scaffolding spent time chasing whether it was the deploy path. The audit notes this directly: the scaffolding's existence created discoverability cost without supporting any production workflow.

Three concrete reasons to delete rather than defer:

1. **Aspirational scaffolding rots.** `scripts/deploy.sh` referenced `docker/Dockerfile.dashboard` for an `apps/dashboard/` that does not exist. The longer the scaffold stays, the further it drifts from any usable starting point.
2. **Vercel + Forge Docker covers the whole customer surface.** Hosted-SaaS customers are on Vercel; enterprise customers run Forge Docker. There is no third deployment surface that Kubernetes would address.
3. **Reversibility is real.** `git log -- infrastructure/k8s/` recovers the scaffolding if a future Kubernetes path becomes necessary. This ADR records the search keyword.

## What this PR removes

```
docs/decisions/2026-05-08-deployment-target-vercel-not-k8s.md   (this ADR — added)
infrastructure/k8s/                                              (entire directory)
infrastructure/docker/Dockerfile.base
infrastructure/docker/Dockerfile.admin
infrastructure/docker/nginx/
infrastructure/docker/prometheus/
infrastructure/docker-compose/production.yml
infrastructure/scripts/deployment/staging-deploy.sh
scripts/deploy.sh
scripts/rollback.sh
```

What stays under `infrastructure/`:

- `infrastructure/.dockerignore` — used by Docker builds
- `infrastructure/docker-compose/services/electric.yml` — referenced by `docs/CI_CD_GUIDE.md` for ElectricSQL self-hosting
- `infrastructure/docker-compose/services/test.yml` — used by `pnpm db:setup-test` via `scripts/dev-tools/test-database.ts`

## Code changes paired with the deletion

- [`scripts/validate/structure.ts`](../../scripts/validate/structure.ts): drops the `infrastructure/docker` + `infrastructure/k8s` `required: true` rules and the `RequiredInfrastructureSubdirs` runtime check. The `infrastructure/` directory itself remains required (the live ElectricSQL + test compose configs live there).
- [`docker-compose.yml`](../../docker-compose.yml): removes the commented-out optional nginx reverse-proxy service block (lines 124–146 pre-cut), since the `infrastructure/docker/nginx/` files it referenced no longer exist.
- `docs/CI_CD_GUIDE.md` (maintainer-internal): the §"Aspirational scaffolding (NOT live)" section is replaced with a forward-looking pointer to this ADR.

## If a future Kubernetes pivot becomes necessary

Recover historical scaffolding via:

```bash
git log --oneline --all -- infrastructure/k8s/ scripts/deploy.sh
git show <commit>:infrastructure/k8s/deployments/admin.yaml
```

The `dashboard` artifacts in the historical scaffolding referenced an `apps/dashboard/` that does not exist — any recovery path must scrub those before applying.

The newer starting point would not be the historical scaffolding regardless. Forge already produces production-grade Docker images per app via [`docker.yml`](../../.github/workflows/docker.yml); a Kubernetes path would build manifests around those images, not around the kubectl shell scripts deleted here.

## Consequences

- **One canonical CI/CD surface.** `docs/CI_CD_GUIDE.md` describes Vercel + Forge Docker only. No "we have this other path too" caveats.
- **`pnpm validate:structure` no longer requires absent k8s/docker subdirectories.** The validator's anti-rules (`k8s/` or `docker/` in repo root → fail) are kept; those still catch misplaced infrastructure files.
- **Customer-facing posture stays stable.** Public docs already presented Vercel + Forge as the supported paths; this ADR brings the repo state into alignment with what was already documented externally.

## References

- Audit: `~/revfleet/.jv/docs/audits/2026-05-08-fleet-doc-quality-audit.md` (commit `e0a59018c` on `revealui-jv:main`)
- [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml) — Vercel production pipeline (validate → migrate → matrix-deploy → smoke → auto-rollback)
- [`.github/workflows/docker.yml`](../../.github/workflows/docker.yml) — Forge Docker image build + GHCR push
- [`docker-compose.forge.yml`](../../docker-compose.forge.yml) — Forge self-hosted stack with license enforcement
- `docs/CI_CD_GUIDE.md` (maintainer-internal) — canonical CI/CD reference (post-shrink)
