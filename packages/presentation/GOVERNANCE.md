---
title: "Governance — `@revealui/presentation` and `@revealui/tokens`"
description: "Who owns what, how a change gets proposed, and how long a review takes. The answer to 'what's the process' when a licensee asks for a component."
visibility: public
status: verified
audience: contributor
---

# Governance

Gate 5, medium finding 15. Governance was implicit: no named owner per area, no
RFC process in force, no published review SLA. Fine for one maintainer — and the
first licensee who wants a component added will ask what the process is, and
"open an issue and I'll see" is not an answer that survives a procurement review.

This documents the process that actually exists. It is deliberately small. A
governance document describing a process nobody follows is worse than none.

## Ownership

| Area | Owner | Scope |
|---|---|---|
| Tokens, brand canon, contrast | `@revealui/tokens` maintainer | Token values, the design-context pack, the contrast contract |
| Components, primitives, hooks | `@revealui/presentation` maintainer | Component APIs, accessibility floor, the export surface |
| Showcases + docs site | docs maintainer | Showcase schema, registry, the published ACR |
| CI gates | whoever owns the area a gate guards | Gate stays with the thing it protects, not with a platform team |

RevealUI Studio is small enough that these are currently the same person. Naming
them separately is not bureaucracy — it means when the team grows, the boundary is
already drawn where the change surfaces are, rather than being invented under
pressure.

## What needs an RFC

Most changes do not. Open a PR.

An RFC — an issue with the `rfc` label, using the template below — is required for:

- **A new component.** Adding one is a permanent support commitment under the
  12-month window in [`SUPPORT.md`](./SUPPORT.md).
- **A breaking API change** to an existing component.
- **Adding, renaming, or removing a `--rvui-*` token.** Tokens are public API.
- **Anything that changes the accessibility floor** or adds a known-issues row.
- **A new dependency.** The packages have three runtime dependencies. Each new one
  is a supply-chain surface a licensee must audit.

Not needed for: bug fixes, adding a value to an existing prop, docs, tests,
showcase work, or CI changes.

### RFC template

```markdown
## Problem
What is broken or missing. One paragraph. Evidence beats assertion — a real
call site beats a hypothetical one.

## Proposal
The API or token shape. Show the code a consumer writes.

## Alternatives
At least one, with why it loses. "No alternatives" almost always means the
problem statement is too narrow.

## Cost
- Breaking? Which consumers, and the codemod.
- New tokens? Which, and the contrast ratios.
- Accessibility: which criteria this must meet, and how they get tested.
- Support: what we are agreeing to carry for 12 months.

## Open questions
What you want a decision on rather than a review of.
```

## Review SLA

| Kind | First response | Decision |
|---|---|---|
| Security report | 48 hours | per [`SECURITY.md`](../../SECURITY.md) |
| Bug with a reproduction | 5 working days | — |
| PR from a contributor | 5 working days | 10 working days |
| RFC | 10 working days | 20 working days |

**These are first-response and decision targets, not fix targets.** A decision can
be "not now, and here is why" — an RFC closed with a reason is a served RFC. What
is not acceptable is silence, which is the failure mode a solo-maintained project
falls into.

If a target is missed, ping the issue. That is not rude; it is the process working.

## Decision record

Decisions that shape the system are recorded, not remembered:

- **Token values and brand** — the `Assessment ·` documents in the design system,
  each dated, with the superseded value named. The dark-brand lift from
  `oklch(0.46)` to `oklch(0.58)` is the model: the old value, the measured ratio
  that failed it, the new ratio, and the pin that keeps it.
- **API shape** — the changeset for the release that ships it, with the migration
  table. `CHANGELOG.md` is the durable record.
- **Anything cross-cutting** — an ADR under `docs/decisions/`.

If a decision is not in one of those three places, it is not a decision, it is a
preference that happened to win.

## Licensing — unambiguous on purpose

`@revealui/presentation` and `@revealui/tokens` are **MIT and stay MIT.**

They are not part of the Fair Source (FSL-1.1-MIT) subset. No JWT gate, no
two-year conversion clause, no commercial trigger.

This matters more than it sounds. The repository has a split licence posture — 20
packages MIT, 5 Fair Source — and a licence auditor reading the repo root cannot
tell which side a package falls on without checking each one. Both design system
packages carry their own `LICENSE` file and state MIT in `package.json`. If you are
auditing, these two are clean.

## Deprecating a component

Removing a component follows [`SUPPORT.md`](./SUPPORT.md)'s deprecation window — at
least two minors with both paths working — plus:

1. An RFC explaining what replaces it. "Nothing" is a valid answer with a reason.
2. A `@deprecated` JSDoc tag naming the replacement (surfaces in editors, which is
   where most people will learn about it).
3. The showcase stays published, marked deprecated, until removal. Deleting the
   docs before the code strands anyone mid-migration.
4. A codemod if the replacement is mechanical.

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the five-step component checklist,
the token rules, and the accessibility floor.

Two additions since that document was written, both now enforced in CI:

- Components may not contain raw Tailwind palette values or `dark:` variants
  (`presentation-lint.cjs`). Use the bridge utilities from `theme.css`.
- Every new component needs `a11y.conformance` in its showcase. It feeds the
  published ACR; an empty one means the component appears as *not assessed*.
