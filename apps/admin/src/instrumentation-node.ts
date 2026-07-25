/**
 * Node.js-only instrumentation.
 *
 * Imported by `instrumentation.ts` ONLY behind `process.env.NEXT_RUNTIME ===
 * 'nodejs'`. Anything that pulls in Node-only dependencies — here the RevealUI
 * engine (`getRevealUIInstance` → `@revealui/core/nextjs` → `@revealui/db`) —
 * MUST live in this module, never directly in `instrumentation.ts`, so it is
 * never traced into the Edge runtime bundle. (Next.js statically traces every
 * import in `instrumentation.ts`, even dynamic ones; the `NEXT_RUNTIME` guard
 * around the import of this file is what excludes it from the Edge build.)
 */

/**
 * GAP-214: deterministically initialize the RevealUI engine once at container
 * boot on self-hosted RevForge kits, so `config.onInit` — the first-admin
 * seeder in `apps/admin/revealui.config.ts` — runs reliably instead of relying
 * on a lazy, unreliable first-request init.
 *
 * Scoped to `RUNTIME_INIT`, which is set only on Forge kits (see
 * `apps/admin/Dockerfile.forge` and the revforge `docker-compose.yml`). Hosted
 * SaaS leaves `RUNTIME_INIT` unset and seeds the first admin via
 * `account_entitlements`, so its boot path is unchanged and the engine (+
 * `@revealui/db`) is never even imported here.
 *
 * Idempotent: `onInit` checks `users === 0` before creating the admin, so a
 * second boot is a no-op. Never throws: the Next.js instrumentation contract is
 * "never throw — it kills the runtime", so any failure is logged and swallowed
 * (a retry on the next boot is safe because of idempotency).
 */
/**
 * GAP-338: swap the process-wide `@revealui/security` AuditSystem onto
 * persistent storage at admin boot — the same
 * `assertAuditStorageEnv()` + `installAuditStorage()` pair apps/server runs
 * (shared home: `@revealui/auth/server`). Without this, every admin-process
 * audit emit (including the GAP-334 login receipts wired through the auth
 * bridge) lands in the default `InMemoryAuditStorage` and evaporates on
 * restart, never reaching the `audit_log` table the audit-trail UI reads.
 *
 * Semantics mirror the admin instrumentation contract:
 * - Env parity failure in production: refuse to serve via `process.exit(1)` —
 *   the intentional kill, same rail as the env-validation block in
 *   `instrumentation.ts` (never `throw`; it kills the runtime accidentally).
 * - `SKIP_ENV_VALIDATION=true` in production skips ONLY the fail-fast, never
 *   persistence: the store is installed anyway (#2156 review finding — the
 *   escape hatch must not silently downgrade a production admin to the
 *   in-memory sink).
 * - Env parity failure in dev: warn to stderr and keep the in-memory sink —
 *   honest and loud, but a dev shell without a DB must still boot.
 * - In production, a fire-and-forget `auditStorageSelfTest()` round trip runs
 *   after install as the executable proof the swap landed (#2156 review
 *   finding); failure screams on stderr rather than blocking a serverless
 *   cold start.
 * - Any unexpected failure: logged, swallowed (never throw out of
 *   instrumentation).
 */
export async function installAdminAuditStorage(): Promise<void> {
  try {
    const { assertAuditStorageEnv, auditStorageSelfTest, installAuditStorage } = await import(
      '@revealui/auth/audit-storage'
    );

    let parityFailure: string | null = null;
    try {
      assertAuditStorageEnv();
    } catch (err) {
      parityFailure = err instanceof Error ? err.message : String(err);
    }

    if (parityFailure !== null) {
      if (process.env.NODE_ENV === 'production') {
        if (process.env.SKIP_ENV_VALIDATION !== 'true') {
          process.stderr.write(`AUDIT STORAGE ENV PARITY FAILED (admin):\n  - ${parityFailure}\n`);
          process.exit(1);
        }
        // #2156 review finding: SKIP_ENV_VALIDATION skips the fail-fast, NEVER
        // persistence. A production admin must not silently downgrade to the
        // in-memory sink under the escape hatch — install anyway; if the env
        // is truly broken the write path fails loudly at request time through
        // the recordAuditWriteResult rails instead of evaporating silently.
        process.stderr.write(
          '[GAP-338] audit env parity failed on a PRODUCTION admin under ' +
            `SKIP_ENV_VALIDATION=true — installing persistent audit storage anyway: ${parityFailure}\n`,
        );
      } else {
        // Dev shells without a DB must still boot; the sink stays in-memory.
        process.stderr.write(
          `[GAP-338] admin audit storage NOT installed (non-production, env incomplete): ${parityFailure}\n`,
        );
        return;
      }
    }

    installAuditStorage();

    // #2156 review finding: the cross-bundle singleton swap needs an
    // EXECUTABLE proof, not an assumption. Run the real write-read round trip
    // through the installed path once per process. Fire-and-forget on this
    // serverless boot path (the same reason apps/server's Vercel path skips
    // the blocking self-test): a failure cannot refuse-to-serve here, but it
    // screams on stderr instead of silently no-oping. The route-bundle-side
    // proof is the /api/health `audit-storage` check (audit.isInMemoryStorage).
    if (process.env.NODE_ENV === 'production') {
      void auditStorageSelfTest().catch((err: unknown) => {
        process.stderr.write(
          '[GAP-338] ADMIN AUDIT SELF-TEST FAILED — admin audit emits may not be ' +
            `persisting: ${err instanceof Error ? err.message : String(err)}\n`,
        );
      });
    }
  } catch (err) {
    process.stderr.write(
      `[GAP-338] admin audit storage install failed (non-fatal): ${
        err instanceof Error ? err.message : String(err)
      }\n`,
    );
  }
}

export async function initEngineAtBoot(): Promise<void> {
  if (!process.env.RUNTIME_INIT) {
    return;
  }

  try {
    const { getRevealUIInstance } = await import('@/lib/utils/revealui-singleton');
    await getRevealUIInstance();
  } catch (err) {
    // Write straight to stderr — the structured logger may not be wired this
    // early in boot, and we must not let this reject (see contract above).
    process.stderr.write(
      `[GAP-214] boot-time engine init failed (non-fatal): ${
        err instanceof Error ? err.message : String(err)
      }\n`,
    );
  }
}
