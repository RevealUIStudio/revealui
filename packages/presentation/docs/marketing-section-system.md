# Marketing section system (type ladder + shells)

**Status:** Phase 0 contracts + Phase 1 primitives shipped in this package.  
**Authority:** Code (`MarketingSection`, `SectionHeader`, `Text`) wins over this doc.

## Problem

Marketing pages were **content-strong** and **layout-primitive-weak**: every section
re-implemented padding, max-width, eyebrow, title, and body color. Body copy often
used `text-muted-foreground` (rung 2), washing hierarchy. Route polish without shells
would fork forever.

## Type ladder (required)

| Role | Token utility | Semantic token | Use for |
|------|---------------|----------------|---------|
| Title / ink | `text-foreground` | `--rvui-text-0` | H1–H3, emphasized labels |
| Body | `text-body` | `--rvui-text-1` | Long reading copy, subtitles, list prose |
| Meta | `text-muted-foreground` | `--rvui-text-2` | Captions, footnotes, secondary labels |

Rules:

1. Do **not** put multi-sentence marketing body on `text-muted-foreground`.
2. Product UI `Text` defaults to **body** (`text-body`), not muted.
3. Use muted only for meta, placeholders, and de-emphasized columns.

## Section shell

`MarketingSection` owns outer chrome:

| Prop | Values | Intent |
|------|--------|--------|
| `tone` | `background` \| `secondary` \| `card` | Surface |
| `width` | `narrow` \| `default` \| `wide` \| `full` | Content max-width |
| `density` | `compact` \| `default` \| `spacious` | Vertical padding |
| `bleed` | boolean | Skip outer horizontal pad (rare) |

`SectionHeader` owns intro stack: optional eyebrow, title, optional description (`text-body`).

Eyebrow tones: `primary` (default brand signal) or `muted` (quiet sections).

## Consumer rules

1. Prefer shells over raw `py-24` / `max-w-7xl` / `px-6` duplication.
2. Keep page-specific content (matrices, calculators) as **children** of the shell.
3. CMS `SectionBlock` body copy must use the body rung (aligned with this ladder).
4. Route craft only after consumers adopt shells (frontend-excellence sequence).

## Pilot + Phase 2 rewire

Home `Hero` + `Problem` were the pilot. Phase 2 rewired remaining marketing
section components and major routes onto `MarketingSection` / `SectionHeader`
(landing, for-operators*, products, pricing, claims, blog index, etc.).

Still intentional non-shell pages: thin document shells (404, some legal),
nested widgets (ProviderSwitch, FrontierPathway), NavBar/Footer.

Phase 3 type burn-down: marketing app reading prose moved to `text-body`;
meta/chrome stays on `text-muted-foreground`. Next: PricingTable/FaqList, then
route craft.
