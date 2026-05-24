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
export async function initEngineAtBoot(): Promise<void> {
  if (!process.env.RUNTIME_INIT) {
    return;
  }

  try {
    const { getRevealUIInstance } = await import('@/lib/utilities/revealui-singleton');
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
