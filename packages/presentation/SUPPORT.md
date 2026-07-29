---
title: "Support policy — `@revealui/presentation` and `@revealui/tokens`"
description: "What we support, for how long, and what we will and won't break. The contract an enterprise dependency review asks for."
visibility: public
status: verified
audience: consumer
---

# Support policy

Applies to **`@revealui/presentation`** and **`@revealui/tokens`** from **1.0.0**
onward. Both packages version together; a major on one is a major on both.

Before 1.0 this policy did not exist, and breaking changes shipped in minors. That
was correct semver for `0.x` and unusable as a dependency answer — it is the
reason this document exists.

## Versioning

We follow [semver](https://semver.org) strictly from 1.0.0.

| Change | Bump |
|---|---|
| Removing or renaming an export | **major** |
| Removing or renaming a prop, or narrowing its accepted values | **major** |
| Removing or renaming a `--rvui-*` token | **major** |
| Narrowing an entry point's surface | **major** |
| Changing a token's *value* (including for accessibility) | minor |
| Changing a component's default appearance | minor |
| Adding an export, prop, or token | minor |
| Adding an accepted value to an existing prop | minor |
| Bug fix with no API or visual change | patch |

Two rows people misread, so they are spelled out:

- **A token value change is a minor, not a patch.** Values are part of the visual
  contract. When we lifted the dark brand from `oklch(0.46)` to `oklch(0.58)` for
  WCAG AA, every dark surface changed. That is not a patch.
- **A default appearance change is a minor.** It cannot break your build, but it
  can change your screenshots. Minors are reviewable; patches are usually not.

## Support window

**Each major is supported for 12 months** from the release of its successor.

Supported means: security fixes, and fixes for regressions we introduced. It does
not mean new features — those land on the current major only.

| Major | Status | Supported until |
|---|---|---|
| 1.x | current | — |
| 0.x | **unsupported** | pre-1.0, never carried a support promise |

We are a small studio and this window is what we can honour without a backport
lane. We would rather publish 12 months and meet it than publish 24 and not.

## Deprecation

Nothing is removed without first being deprecated for **at least two minor
releases**, with both the old and new names working the whole time.

A deprecation ships with:

1. **Both names live.** The old export or prop keeps working, mapped to the new one.
2. **A dev-only console warning**, once per component per session, naming the
   replacement and the version that removes it:
   ```
   [RevealUI] Switch: the `color` prop is deprecated and will be removed in 2.0.
   Use `intent` instead: color="violet" → intent="brand".
   https://docs.revealui.com/migrations/semantic-intents
   ```
   Dev-only and once-per-session is deliberate — a warning that floods a
   production log gets silenced, and a silenced warning is not a warning.
3. **A migration note** in `CHANGELOG.md` with a before/after table.
4. **A codemod** for any mechanical rename, shipped in the same release.

A removal never lands in the same release as its deprecation.

## Public API

Frozen by an export snapshot test (`src/__tests__/api-surface.test.ts`), so an
accidental addition or removal fails CI rather than shipping.

| Entry point | Public |
|---|---|
| `@revealui/presentation` | yes |
| `@revealui/presentation/components` | yes |
| `@revealui/presentation/primitives` | yes |
| `@revealui/presentation/server` | yes |
| `@revealui/presentation/client` | yes |
| `@revealui/presentation/hooks` | yes |
| `@revealui/presentation/animations` | yes |
| `@revealui/presentation/tokens.css` | yes |
| `@revealui/presentation/theme.css` | yes |
| `cn` (main entry or `/server`) | yes |
| the focus-ring constants in `utils/focus.ts` | **no — internal** |
| any file imported by deep path rather than an entry point | **no — internal** |

`cn()` is public and supported — 35 call sites across the apps and `packages/editor`
import it, so it is a utility consumers rely on rather than an implementation detail.
The focus-ring constants are internal so that changing the focus treatment stays a
visual change rather than a breaking one.

## Tokens are part of the contract

`--rvui-*` custom properties are public API. Renaming or removing one is a major.
Adding one is a minor.

`theme.css` maps those tokens into Tailwind's `@theme` namespace. **Import it** —
do not hand-copy the mapping. Copies drift, and a copy that drifts produces
components with no colour and no error message explaining why.

## Accessibility

We target **WCAG 2.2 AA** and publish a per-component conformance table generated
from the component registry, with a dated known-issues list. Every showcase is
scanned with axe-core in CI, in both themes, and a critical or serious violation
fails the build.

A VPAT 2.5 can be produced from that table on request.

Where a component cannot meet AA in a particular composition, it is listed in the
known-issues table rather than omitted. An accessibility claim you cannot
substantiate is worse than a documented gap.

## Browsers

| Target | Support |
|---|---|
| Last 2 versions of Chrome, Edge, Firefox, Safari | supported |
| iOS Safari, Chrome Android — last 2 versions | supported |
| Anything without `oklch()` support | **not supported** |

The token system is OKLCH throughout. There is no sRGB fallback and adding one
would mean maintaining two colour systems.

Visual regression baselines are captured in Chromium only — cross-browser font
hinting makes multi-renderer goldens flaky. Other browsers are covered by smoke
passes, not pixel goldens.

## Security

Report vulnerabilities per the repository [`SECURITY.md`](../../SECURITY.md). Do
not open a public issue for a vulnerability.

Both packages publish with npm provenance (SLSA Build Level 2) via OIDC trusted
publishing, and a CycloneDX SBOM is produced for every release.

## Licensing

`@revealui/presentation` and `@revealui/tokens` are **MIT**, and stay MIT. They
are not part of the Fair Source (FSL-1.1-MIT) subset — no JWT gate, no
conversion clause, no commercial trigger. If you are auditing licences, these two
are unambiguous.

## Getting help

- **Bugs and feature requests** — [GitHub issues](https://github.com/RevealUIStudio/revealui/issues), label `package: presentation`
- **Design-system decisions** (token shape, accessibility tradeoffs, naming) — an issue with the same label
- **Contributing** — [`CONTRIBUTING.md`](./CONTRIBUTING.md)

There is no paid support tier for these packages today. If you need one, say so in
an issue — that is useful signal.
