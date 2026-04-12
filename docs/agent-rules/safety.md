# Safety Conventions

Rules for protecting sensitive files, credentials, and system paths in the RevealUI monorepo.

## Protected Files  -  Never Edit Without Explicit Ask

- `.env*` files (`.env`, `.env.local`, `.env.production`, etc.)
- Lock files: `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `bun.lockb`, etc.
- Database schema files in `packages/db/src/schema/` (changes require migration planning)

## Protected Paths  -  Never Edit

- `/mnt/c/`  -  Windows C: drive (read-only mirror)
- `/mnt/e/`  -  LTS backup drive (read-only)
- System directories: `/etc/`, `/usr/`, `/var/`
- Credential directories: `~/.ssh/`, `~/.gnupg/`, `~/.aws/`

## Credential Detection

Flag and refuse to write code containing:
- Hardcoded API keys, tokens, passwords, or secrets
- Base64-encoded credential strings
- Connection strings with embedded passwords

Use environment variables via `@revealui/config` instead.

## Supabase Import Boundary

`@supabase/supabase-js` must only be imported in designated paths. See `database-boundaries.md` for the full allowed/forbidden path list.

## Code Quality Guards

- Never use `any`  -  use `unknown` + type guards
- Never add `console.*` in production code  -  use `@revealui/utils` logger
- After editing files, run `npx biome check --write <file>` to auto-format

## Verification Before Completion

Before claiming work is done:
1. Run `pnpm gate:quick` (minimum) or the relevant gate phase
2. Confirm output shows no new errors
3. Check `git diff` to review all changes
