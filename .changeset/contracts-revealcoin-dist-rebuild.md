---
'@revealui/contracts': patch
---

Fix: RVUI_MINT_ADDRESSES dist regenerated from manifest source. Pre-fix dist had hardcoded mainnet-beta=devnet-address. Affects only external npm consumers; in-tree consumers always read src/ via workspace links.

The previously published `1.4.0` dist predated the manifest-derived refactor in `packages/contracts/src/revealcoin.ts:59-79` (`deriveNetworkRecord` + the `RVUI_MINT_ADDRESSES` / `RVUI_MINT_AUTHORITY` exports). External consumers of `@revealui/contracts@1.4.0` from npm therefore read the wrong `mainnet-beta` value (the devnet mint address copied across networks). Bumping to `1.4.1` with a clean `pnpm --filter @revealui/contracts build` republishes the correct manifest-derived behavior — empty string for unconfigured networks, the real address only when `REVEALCOIN_MANIFEST.networks[network].mintAddress` is non-empty.

Behavioral fix only. No exported types or schemas change. Per `~/revfleet/.jv/.claude/rules/versioning.md` `@revealui/contracts` exception, patch is the correct semver level (no breaking change).

Audit reference: `~/revfleet/.jv/docs/audits/2026-05-08-charge-readiness-deep-audit.md` §5 Phase 0. Related: revealui#763 (revealcoin frontend mainnet honesty) — same dishonesty class on the frontend; this PR closes the npm-consumer side.
