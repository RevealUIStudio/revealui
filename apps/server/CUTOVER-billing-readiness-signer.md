# CUTOVER — billing-readiness signer mode (REVEALUI-SERVER-A)

Daily `billing-readiness` was failing with `env:REVEALUI_LICENSE_PRIVATE_KEY: MISSING` while Studio production already mints through the hosted signer and intentionally has no mint private key on Vercel serverless.

Joshua lock 2026-09-23 A.Go: readiness matches signer mode. Do not seed `REVEALUI_LICENSE_PRIVATE_KEY` onto `revealui-api`.

## Not in this change

- No Stripe price, catalog, DNS, or webhook work.
- Do not run `pnpm stripe:sync-env` unless a different readiness failure remains after this cutover.
- Do not resolve Sentry from the commit or the PR. The trailer is `Refs REVEALUI-SERVER-A`, not `Fixes`.

## After merge to `test`

Owner/Bot promote path as usual when Joshua says promote. This change does not promote `test` to production by itself.

## Verify

1. Production still has `REVEALUI_LICENSE_SIGN_VIA_SIGNER`, `REVEALUI_LICENSE_SIGNER_URL`, `REVEALUI_LICENSE_PUBLIC_KEY`, and `REVEALUI_SIGNER_INVOKE_SECRET`. `REVEALUI_LICENSE_PRIVATE_KEY` stays off the serverless mint path.
2. Next production cron `GET /api/cron/dispatch` (includes `billing-readiness`) around 06:00 UTC is green. The license section must not report `env:REVEALUI_LICENSE_PRIVATE_KEY: MISSING`.
3. A signer liveness probe (`GET {REVEALUI_LICENSE_SIGNER_URL}/health/live`) is best-effort. A miss is a warning, not a readiness failure.

## Sentry

Leave **REVEALUI-SERVER-A** open until one green production cron day after this cutover. Do not auto-resolve from CI.
