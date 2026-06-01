#!/usr/bin/env tsx

/**
 * Run the admin app locally, programmatically (headless-friendly).
 *
 * Distinct from the neighbouring entry points:
 *   - `pnpm dev:admin`  — starts the admin dev server but does NOT provision a DB.
 *   - `revealui admin`  — auto-ensures the Nix-managed local Postgres (.pgdata)
 *                         and assumes an interactive Nix/direnv shell.
 *
 * This command provisions a migrated database against ANY connection string
 * (the Nix local Postgres, a CI service container, the docker-compose fallback,
 * or a Neon branch) via `ensureTestDatabase()`, then launches the admin dev
 * server (`pnpm dev:admin` → build:auth + `next dev` on :4000). Suitable for
 * scripted / agent / preview-environment runs.
 *
 * Secrets: inside the Nix/direnv shell, revvault has already exported the admin
 * secrets (see `.envrc`). In a bare shell, export the DB URL + admin secrets
 * first (POSTGRES_URL + the `revealui/env/admin` namespace). The headless recipe
 * lives in the `dev-test-db-strategy` lane plan (.jv).
 *
 * Usage:
 *   pnpm dev:admin:local              # provision DB (migrate), then start admin :4000
 *   pnpm dev:admin:local --seed       # also seed before starting
 *   pnpm dev:admin:local --push       # schema push instead of migrate
 *   POSTGRES_URL=… pnpm dev:admin:local
 *
 * @dependencies
 * - @revealui/scripts/errors - ErrorCode enum for exit codes
 * - @revealui/scripts - createLogger, getProjectRoot
 * - ./test-database - ensureTestDatabase (shared provisioning)
 * - node:child_process - execFileSync (long-running dev server)
 */

import { execFileSync } from 'node:child_process';
import { ErrorCode } from '@revealui/scripts/errors.js';
import { createLogger, getProjectRoot } from '@revealui/scripts/index.js';
import { ensureTestDatabase } from './test-database.js';

const logger = createLogger();

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const projectRoot = await getProjectRoot(import.meta.url);

  logger.header('Admin (local, programmatic)');

  const { url, migrated } = await ensureTestDatabase({
    push: argv.includes('--push'),
    seed: argv.includes('--seed'),
  });

  if (!migrated) {
    logger.error(
      'Database schema was not applied — refusing to start admin against an unmigrated DB',
    );
    process.exit(ErrorCode.EXECUTION_ERROR);
  }

  logger.info('Starting admin (build:auth + next dev on http://localhost:4000)…');
  // Long-running: inherits stdio and stays attached until interrupted.
  // Delegates to the existing `dev:admin` script rather than duplicating it.
  execFileSync('pnpm', ['run', 'dev:admin'], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: { ...process.env, POSTGRES_URL: url, DATABASE_URL: url },
  });
}

main().catch((error) => {
  logger.error(`admin local run failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(ErrorCode.EXECUTION_ERROR);
});
