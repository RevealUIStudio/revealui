# Security Audit Status

**Last updated:** 2026-04-18
**Session:** Commercial readiness marathon (continuation)

## Closed

| ID | Finding | Fix | PR |
|----|---------|-----|----|
| P2-1 | Trusted-proxy: X-Forwarded-For spoofable | `getClientIp()` with rightmost-untrusted strategy | #371 |
| P2-2 | SSRF: MCP adapter fetches to private IPs | `assertPublicUrl()` with DNS + private IP blocking | #371 |
| P2-3 | Manual SQL outside Drizzle | Migration 0002 + deleted 5 redundant files | #371 |
| P3-1 | Cross-DB FK: VectorMemoryService.update() | `assertCrossDbRefs` on siteId changes | #371 |
| P3-2 | Transaction guards: direct db.transaction() | Replaced with `withTransaction()` in 3 API routes | #371 |
| P3-3 | Audit-log writable via UPDATE/DELETE | Trigger deployed to production NeonDB (verified) | #371 |
| P3-4 | OTP attempt increment | Already atomic with Neon HTTP fallback | N/A |
| P3-5 | No backup verification | `verify-backup.ts` + GitHub Actions daily cron | #371 |
| WH-1 | Silent payment drop on cleanup failure | `unreconciled_webhooks` table + 200-on-failure | #372 |
| WH-4 | Wrong tier in payment receipt | Scoped license query to `invoice.subscription` | #372 |
| DOCS | Inflated numbers in README/MASTER_PLAN | Replaced with grep-reproducible counts | #372 |
| WH-2 | License key non-idempotent across saga retries | Moved `generateLicenseKey()` inside saga steps + idempotency guard at all 4 call sites | #TBD |

## Open

| ID | Finding | Severity | Blocker? | Notes |
|----|---------|----------|----------|-------|
| WH-3 | Concurrent event race on syncHostedSubscriptionState | Medium | No | Add event timestamp guard to UPDATE WHERE clause; failure mode is temporary stale status, not data loss |
| CRON | Reconciliation cron for unreconciled_webhooks | Medium | No | Table exists, consumer pending; without cron, rows land but nobody is alerted |

## Verification Checks (2026-04-18)

- **Revealcoin keys:** Private key files on disk, never committed to git, gitignored, 0600 permissions. No rotation needed.
- **Config secret literal:** Comment/example only (line 87), not runtime code.
- **RevDev socket:** No chmod 0600 in Rust source. Socket not running. Low priority.
- **Dependabot PRs:** Zero open.
