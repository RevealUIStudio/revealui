---
title: "Dependency advisory follow-up"
description: "Tracks the dependency advisories that remain after patched releases are enforced by the workspace lockfile."
visibility: internal
status: active
audience: maintainer
last-updated: 2026-10-06
---

# Dependency advisory follow-up

## Remediated in this change

The root dependency policy in `package.json` and `pnpm-lock.yaml` now requires
patched releases for the findings with available compatible fixes:

| Package | Vulnerable version | Required version | Dependency owner |
|---------|--------------------|------------------|------------------|
| `proxy-addr` | 2.0.7 | 2.0.8 or later | Root MCP SDK dependency graph |
| `shell-quote` | 1.10.0 | 1.11.0 or later | Root `concurrently` dependency graph |
| `@modelcontextprotocol/sdk` | 1.29.0 | 1.31.0 or later | Root MCP tooling |
| `source-map-js` | 1.2.1 | 1.2.2 or later | Root Vitest coverage dependency graph |
| `basic-ftp` | 6.0.1 | 6.2.1 or later | Root Vercel tooling dependency graph |
| `smol-toml` | 1.8.0 | 1.9.0 or later | Root and Vercel tooling dependency graphs |
| `sharp` | 0.35.4 | 0.35.5 or later | `apps/admin` image processing |

The 2026-10-06 registry audit reports zero critical findings after these lockfile
updates. The security gate passes. The audit still reports three high and three
moderate findings listed below; the registry currently reports no patched
release for four advisories. One moderate finding has a fixed release on a new
major version whose current consumer has not been shown compatible.

## Open upstream blockers

| Severity | Package and owner path | Failure class | Durable target and removal evidence |
|----------|------------------------|---------------|-------------------------------------|
| High | `node-forge` via `packages/auth` → `selfsigned`; used only by `packages/auth/src/server/sso/__tests__/helpers/mock-saml-idp.ts` | Malformed nested digest algorithms can make RSA PKCS#1 v1.5 signature verification accept a forged signature. | Replace or upgrade the test certificate generator when a maintained compatible release exists. Run the SSO/SAML auth tests and verify the resolved tree no longer contains the vulnerable advisory. The current registry record lists no patched version. [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv) |
| High | `http-cache-semantics` via `packages/apify-actor-governed-run` → `apify` → Crawlee → Got | `max-stale` handling can expose one user's cached response to another user. | Upgrade the owning Apify/Crawlee/Got chain when it carries a fixed release; test the actor's request and cache behavior, then verify the lockfile no longer resolves the vulnerable advisory. The current registry record lists no patched version. [GHSA-ch52-4w7c-c8xp](https://github.com/advisories/GHSA-ch52-4w7c-c8xp) |
| High | Root `@changesets/cli` → micromatch → `braces` | Deeply nested patterns can exhaust the stack. | Upgrade the Changesets/micromatch dependency chain when a compatible fixed release is available; run changeset validation and verify the advisory clears. The current registry record lists no patched version. [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) |
| Moderate | `apps/admin` → Hugging Face Transformers → ONNX Runtime → `sprintf-js`; `apps/license-signer` → tsup → API Extractor → `sprintf-js` | Unbounded precision specifiers can cause denial of service. | Upgrade or remove the owning chains when fixed releases are available; run admin model-processing and license-signer build/tests, then verify both vulnerable resolutions are gone. The current registry record lists no patched version. [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) |
| Moderate | `packages/dev` → `@tailwindcss/typography` → `postcss-selector-parser` 6.0.10 | Flat selectors with many indexes can cause quadratic parse time. | The patched parser is 7.1.6 or later, a major-version change from the consumer's current 6.x dependency. Upgrade the consumer once it supports the fixed major, or prove compatibility with its Tailwind builds and visual/component tests before changing the override. Verify the vulnerable 6.x resolution is gone. [GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) |

## Tracking and validation

This file is the tracked follow-up for upstream-blocked advisories. Recheck it
with the weekly dependency audit evidence in the GitHub Security tab and update
it when an owning upstream release becomes available. Do not add an exception,
advisory suppression, or local patched fork to make the gate green.

For each closure, require a fresh `pnpm audit`, the relevant owning-package
tests/builds, the security gate, and a lockfile inspection showing the fixed
release on every affected path.
