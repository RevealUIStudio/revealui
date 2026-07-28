---
'@revealui/harnesses': minor
---

Add the shared archive-check gate (`./gates` export): `scanInboundLinks`,
`isHistoricalPath`, `countOccurrences`, `ARCHIVE_URL_PREFIX`, and the per-repo
historical-path marker sets.

Docs moved to the central fleet archive must leave no live inbound links
behind. That rule was previously enforced only in the private coordination
repo, so links could rot in the public repo — the one place a dead link is
externally visible. The matching logic now has one home here and is consumed by
both repos' thin adapters, so the two cannot drift (same reasoning as the
existing doc-currency and guardrail2-verdict gate exports).
