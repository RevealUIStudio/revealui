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
 * - Env parity failure in production: refuse to serve via `process.exit(1)`,
 *   UNCONDITIONALLY — the same rail as the worker, which calls the assert
 *   bare (apps/server/src/worker.ts). There is deliberately NO caller-side
 *   `SKIP_ENV_VALIDATION` carve-out here: the #2161 review proved the
 *   "install anyway under SKIP" branch was both dead (a missing DB URL makes
 *   `getClient()` throw, so nothing installs) and hazardous (a missing
 *   signing key would land UNSIGNED rows in the production audit_log, which
 *   the anchor sweep filters and which stall contiguity). The audit path has
 *   no escape hatch; the assert's own internal SKIP gate for the signing key
 *   is the single shared exception, identical on every process.
 * - Env parity failure in dev: warn to stderr and keep the in-memory sink —
 *   honest and loud, but a dev shell without a DB must still boot.
 * - Executable proof the swap landed (#2156 review): on Forge kits
 *   (`RUNTIME_INIT`, long-running container) the `auditStorageSelfTest()`
 *   round trip BLOCKS and kills the boot on failure — true refuse-to-serve,
 *   same as the worker. On serverless production it runs fire-and-forget
 *   (a blocking DB round trip per cold start buys latency, not a guarantee
 *   Vercel can act on) and screams on stderr; the route-bundle-side proof is
 *   the /api/health `audit-storage` check (audit.isInMemoryStorage).
 * - Any unexpected failure: logged, swallowed (never throw out of
 *   instrumentation).
 */
export async function installAdminAuditStorage(): Promise<void> {
  try {
    const { assertAuditStorageEnv, auditStorageSelfTest, installAuditStorage } = await import(
      '@revealui/auth/audit-storage'
    );

    try {
      assertAuditStorageEnv();
    } catch (err) {
      const parityFailure = err instanceof Error ? err.message : String(err);
      if (process.env.NODE_ENV === 'production') {
        process.stderr.write(`AUDIT STORAGE ENV PARITY FAILED (admin):\n  - ${parityFailure}\n`);
        process.exit(1);
      }
      // Dev shells without a DB must still boot; the sink stays in-memory.
      process.stderr.write(
        `[GAP-338] admin audit storage NOT installed (non-production, env incomplete): ${parityFailure}\n`,
      );
      return;
    }

    installAuditStorage();

    if (process.env.RUNTIME_INIT) {
      // Forge kit: a long-running container with an async boot chain, the
      // same shape as the worker — the self-test blocks and a failure is the
      // intentional kill (fail-closed integrity, ADR §2a).
      try {
        await auditStorageSelfTest();
      } catch (err) {
        process.stderr.write(
          '[GAP-338] ADMIN AUDIT SELF-TEST FAILED (Forge boot) — refusing to serve: ' +
            `${err instanceof Error ? err.message : String(err)}\n`,
        );
        process.exit(1);
      }
    } else if (process.env.NODE_ENV === 'production') {
      // Serverless: fire-and-forget. A failure cannot refuse-to-serve here,
      // but it screams on stderr instead of silently no-oping.
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
