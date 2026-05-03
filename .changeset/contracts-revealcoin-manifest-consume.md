---
'@revealui/contracts': minor
---

Refactor revealcoin to consume @revealui/revealcoin-manifest

Per docs/decisions/2026-05-03-revealcoin-manifest-transport.md §Phase 4,
RVUI_MINT_ADDRESSES + RVUI_MINT_AUTHORITY now derive from
manifest.networks; RVUI_ALLOCATIONS[].wallet derives from
manifest.allocations by-name match. Human-decided fields
(percentage, amount, vestingDescription) plus helpers
(formatRvuiAmount, parseRvuiAmount, getRvuiMintAddress) unchanged.
SolanaNetwork type is now re-exported from the manifest (same string
union, no consumer-visible change). Existing exports preserved
shape-identical per the ADR's "no behavior change for consumers"
guarantee.
