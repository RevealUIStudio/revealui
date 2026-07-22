---
title: "RevealUI Scripts"
description: "TypeScript and shell scripts for development, automation, and tooling in the RevealUI monorepo."
visibility: internal
status: verified
audience: contributor
---

# RevealUI Scripts

TypeScript and shell scripts for development, automation, and tooling in the RevealUI monorepo.

Scripts are organized into per-purpose directories under `scripts/` and surfaced
through `package.json` aliases in the repo root. There is no single master CLI:
most scripts run directly via a `pnpm <alias>` script, and a couple of small CLIs
(`scripts`, `release`) provide interactive entry points built on the shared
`BaseCLI` class.

## Quick Start

Run scripts through their root `package.json` aliases:

```bash
pnpm audit:any              # Find avoidable `any` types
pnpm audit:console          # Find production console statements
pnpm validate:boundary      # Package boundary enforcement
pnpm db:init                # Initialize the database
pnpm release:dry-run        # Simulate a release
pnpm scripts list           # Explore the script registry
```

To discover what exists, list a directory or read the root `package.json` scripts
block:

```bash
ls scripts/analyze/
ls scripts/validate/
jq '.scripts' package.json
```

---

## Directory Structure

```
scripts/
├── cli/                       # CLIs built on BaseCLI
│   ├── _base.ts               # BaseCLI / ExecutingCLI / DispatcherCLI abstractions
│   ├── scripts.ts             # `pnpm scripts` — interactive script explorer
│   └── release.ts             # `pnpm release` — publish/release flows
├── analyze/                   # Read-only audits (any-types, console, emdash, palette)
│   └── __tests__/
├── validate/                  # Pass/fail validation gates (see validate/README.md)
├── gates/                     # CI quality gates
│   ├── ci-gate.ts             # `pnpm gate` orchestrator
│   ├── security-gate.ts       # `pnpm gate:security`
│   ├── test-coverage-gate.ts  # `pnpm coverage:check`
│   ├── types-gate.ts          # `pnpm gate:types`
│   └── ops/deploy.ts          # `pnpm deploy`
├── setup/                     # DB init, Stripe/billing, staging secrets, MCP setup
│   └── __tests__/
├── dev-tools/                 # Dev + integration test utilities (see dev-tools/README.md)
├── commands/
│   └── database/              # backup, restore, status, verify-backup, query stats
├── secrets/                   # generate.ts, rotate.ts, scan.ts
├── security/                  # rotate-kek.ts (+ __tests__)
├── sync/                      # revvault secret-path sync + manifests
│   └── __tests__/
├── migrations/                # verify-pages-canonical.ts
├── admin/                     # bootstrap.ts (`pnpm admin:bootstrap`)
├── blog/                      # import-markdown.ts
├── docs/                      # generate-api.ts (`pnpm docs:generate:api`)
├── e2e/                       # run-with-mcp.ts
├── electric-latency-probe/    # Electric sync latency probe (own README)
├── leak-scan/                 # client-leak scanner (own README + __tests__)
├── git-hooks/                 # pre-commit, push.sh, cleanup.sh
├── lib/                       # md-links.ts (shared markdown extractors)
├── utils/                     # base.ts (shared script helpers)
├── seed-fleet-marketing-site.ts       # `pnpm db:seed:fleet-marketing`
├── seed-fleet-marketing-home-page.ts  # `pnpm db:seed:fleet-marketing-home`
├── dev-tools/dogfood-api.ts             # `pnpm dogfood:api` (local server + env)
├── gen-brand-assets.cjs               # brand asset generation
├── audit-no-submodules.sh
└── check-client-leaks.sh
```

Shared library utilities (`logger`, `exec`, `paths`, `state`, `validation`,
`errors`) live in the `@revealui/scripts` package (`packages/scripts`), imported
as `@revealui/scripts/*`. The local `scripts/lib/` directory holds only
`md-links.ts`.

---

## Common Commands

Every command below is a real alias in the root `package.json`. Run
`jq '.scripts' package.json` for the full list.

### Code Quality & Auditing

```bash
pnpm audit:any               # Find avoidable `any` types
pnpm audit:console           # Find production console statements
pnpm audit:emdash            # Find em dashes in copy
pnpm audit:palette-text      # Audit text against the brand palette
pnpm lint                    # Biome lint
pnpm format                  # Biome format
pnpm typecheck:all           # TypeScript check across all workspaces
```

### Validation Gates

```bash
pnpm gate                    # Full CI gate (quality + typecheck + test + build)
pnpm gate:quick              # Phase 1 only
pnpm gate:security           # Security gate
pnpm gate:types              # Type gate
pnpm preflight               # Full pre-launch checklist
pnpm validate:boundary       # Package boundary enforcement
pnpm validate:structure      # Project structure check
pnpm validate:claims         # Claim-drift validation
pnpm validate:doc-currency   # Documentation currency check
```

See [validate/README.md](./validate/README.md) for the full validator index.

### Database

```bash
pnpm db:init                 # Initialize database
pnpm db:migrate              # Run migrations
pnpm db:seed                 # Seed sample data
pnpm db:reset                # Reset database (destructive)
pnpm db:status               # Show database status
pnpm db:backup               # Create a backup
pnpm db:restore              # Restore from a backup
pnpm db:setup-test           # Set up the test database
```

See [setup/README.md](./setup/README.md) and `scripts/commands/database/` for details.

### Secrets

```bash
pnpm secrets:generate        # Generate secrets
pnpm secrets:scan            # Scan for leaked secrets
```

### Testing

```bash
pnpm test                    # Run all tests (turbo)
pnpm test:coverage           # Tests with coverage
pnpm test:e2e                # Playwright E2E tests
pnpm test:integration        # Integration tests (sets up the test DB)
```

### Release Management

```bash
pnpm release                 # Release CLI entry (scripts/cli/release.ts)
pnpm release:dry-run         # Simulate a release (no changes)
pnpm release:status          # Show pending changeset status
pnpm release:oss             # Publish OSS packages
pnpm release:pro             # Publish Pro packages
```

### Script Explorer

```bash
pnpm scripts list                    # List registered scripts by category
pnpm scripts search <query>          # Full-text search
pnpm scripts info <name>             # Detailed info for one script
pnpm scripts run <name> <command>    # Execute a registered script with validation
pnpm scripts history                 # Execution history
```

---

## Architecture

### BaseCLI Pattern

The interactive CLIs in `scripts/cli/` extend `BaseCLI` from
[cli/_base.ts](./cli/_base.ts):

```typescript
class MyCLI extends BaseCLI {
  name = "mycli";
  description = "My CLI tool";

  defineCommands(): CommandDefinition[] {
    return [
      {
        name: "mycommand",
        description: "My command",
        handler: async (args) => this.myCommand(args),
      },
    ];
  }
}
```

`_base.ts` provides three abstractions:

- **`BaseCLI`**, argument parsing, dual-mode output (human + JSON), error
  handling with exit codes, confirmation prompts, and help generation.
- **`ExecutingCLI`**, adds execution logging to the audit log (used by
  `scripts.ts`).
- **`DispatcherCLI`**, maps command names to script paths and forwards
  arguments via `dispatchCommand`.

All three import their shared utilities (`args`, `output`, `errors`,
`execution-logger`, `dispatch`) from the `@revealui/scripts` package.

### Shared Libraries (`@revealui/scripts`)

Reusable utilities used across scripts live in `packages/scripts` and are
imported as `@revealui/scripts/*`:

- **logger**, structured logging
- **exec**, command execution
- **paths**, path resolution
- **errors**, error handling with exit codes
- **validation**, environment and database validation
- **state**, workflow state management (memory + PGlite adapters)

The local `scripts/lib/md-links.ts` holds zero-regex markdown extractors shared
by the root-level doc validators. `scripts/utils/base.ts` holds shared script
helpers.

---

## Finding Scripts

### By Category

```bash
ls scripts/analyze/          # Read-only audits
ls scripts/validate/         # Validation gates
ls scripts/setup/            # Environment + database setup
ls scripts/gates/            # CI quality gates
ls scripts/commands/database/  # Database operations
```

### By Function

- **Database**: `scripts/setup/`, `scripts/commands/database/`
- **Testing**: `scripts/dev-tools/`
- **Analysis**: `scripts/analyze/`
- **Validation**: `scripts/validate/`, `scripts/gates/`
- **Secrets**: `scripts/secrets/`, `scripts/sync/`
- **Release**: `scripts/cli/release.ts`

---

## Contributing

When adding a new script:

1. Place it in the directory that matches its purpose (`analyze/`, `validate/`,
   `setup/`, etc.).
2. Add a `package.json` alias in the repo root so it is discoverable.
3. Add tests next to the script in a `__tests__/` directory where the category
   has one.
4. For a new interactive CLI, extend `BaseCLI` (see [cli/_base.ts](./cli/_base.ts)).
5. Update the relevant per-directory README.

---

## Further Documentation

- **Standards**: [STANDARDS.md](./STANDARDS.md), package.json script conventions
- **Architecture**: [ARCHITECTURE.md](./ARCHITECTURE.md), how the CLIs and gates fit together
- **Validation**: [validate/README.md](./validate/README.md)
- **Dev Tools**: [dev-tools/README.md](./dev-tools/README.md)
- **Setup**: [setup/README.md](./setup/README.md)

### Local dogfood (VES + API)

```bash
pnpm db:migrate                 # if audit_log / schema lag docker
pnpm dogfood:api                # API :3004 (DB via seed-env, license via revvault)
# optional if voice gate rejects section/ctaSection after a pull:
pnpm dogfood:api -- --build-contracts

# apps/admin/.env.local
# NEXT_PUBLIC_API_URL=http://localhost:3004

pnpm --filter marketing dev     # :3000
pnpm dev:admin                  # :4000 — restart after changing NEXT_PUBLIC_*
```
