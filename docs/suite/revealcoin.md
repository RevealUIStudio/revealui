---
title: "RevealCoin (RVC)"
description: "Hybrid utility/governance/reward token on Solana Token-2022. RVC is the customer-facing on-chain ticker."
category: suite
audience: developer
---

# RevealCoin

**Hybrid utility / governance / reward token for the RevealUI ecosystem, built on Solana's Token-2022 program.**

> RevealCoin is a separate suite product. The repo is at [RevealUIStudio/revealcoin](https://github.com/RevealUIStudio/revealcoin). The customer-facing landing page is [revealcoin.revealui.com](https://revealcoin.revealui.com), deployed from `apps/revealcoin` in the RevealUI monorepo.

## Token spec

| Field | Value |
|---|---|
| **Name** | RevealCoin |
| **Symbol (customer-facing)** | `RVC` |
| **Decimals** | 6 |
| **Total Supply** | 58,906,000,000 |
| **Program** | Solana Token-2022 (Token Extensions) |
| **Extensions** | MetadataPointer, TokenMetadata |
| **Freeze Authority** | None (permanently renounced) |

> 58,906,000,000 — US currency in circulation on August 14, 1971, the day before Nixon ended dollar–gold convertibility.

## Mainnet deployment

| Parameter | Value |
|---|---|
| **Network** | Solana Mainnet-Beta |
| **Mint Address** | `4Ysb1gkz21FD2B9P8P5Pm8bHh4CAMKYU1L528e1MigPo` |

The mint is deployed and metadata is on-chain. **RevealCoin is pre-launch for public distribution.** The following gates are open:

- **On-chain vesting** schedules for team / contributor / treasury allocations
- **Multi-sig** controls for treasury operations
- **Raydium pool** initialization for public liquidity

Until those gates close, the token is not publicly distributed and live trading is not enabled.

## Internal vs external naming

This is the most common drift point in the docs surface — worth memorising:

- **`RVC`** is the **customer-facing on-chain ticker.** Marketing copy, customer-facing API messages, public docs, and Solana Explorer all use `RVC`.
- **`$RVUI`** is the **internal codename.** It appears in code constants, env-var prefixes (`REVEALUI_RVUI_*`), database column names, and route paths (e.g. `/api/billing/rvui-payment`). Internal Kingdom-taxonomy lore preserved this naming through the rename to RevealCoin.

Both are correct *in their respective contexts* — but a public doc that says *"RVUI payment is not available"* is leaking internal naming. Customer-visible strings should always say `RVC`.

## How it composes with RevealUI

When public distribution opens (post-vesting / multi-sig / Raydium gates), the integration story is:

- **MCP marketplace per-call pricing in `RVC`** via the x402 protocol. Agents pay other agents in tokens.
- **Tier-gated `RVC` rewards** for ecosystem participation (open question per pricing docs).
- **`RVC` payment endpoint**: `POST /api/billing/rvui-payment` (route slug retains internal `rvui-` codename) — currently returns `501 RVC payment is not yet available`.

None of this is live yet. Treat any doc that says *"agents can pay in `RVC` today"* as drift.

## Status

Pre-launch (mainnet mint deployed, public distribution gated).

## See also

- [Suite overview](../SUITE) — how RevealCoin relates to the rest of the suite
- [Marketplace](../MARKETPLACE) — where RVC pricing flows in once public distribution opens
- [HTTP 402 Payments blog post](../blog/02-http-402-payments) — payment-protocol context
- [RevealCoin README](https://github.com/RevealUIStudio/revealcoin/blob/main/README.md) — canonical product docs
- [revealcoin.revealui.com](https://revealcoin.revealui.com) — public landing page + tokenomics
