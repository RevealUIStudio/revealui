# Design-system scripts

## `token-drift-gate.cjs` — keep the token mirror honest

A dependency-free Node gate that holds `reference/presentation-tokens.css` (the
mirror of the codebase's canonical `tokens.css`) to three invariants:

1. **Mirror pin** — the file must match `reference/MIRROR.sha256`. Any edit is a
   conscious, reviewed act: change the file ⇒ bump the pin.
2. **Value pins** — the cobalt brand values must be present
   (`light = oklch(0.36 0.190 240)`, `dark = oklch(0.58 0.150 240)`). The 0.46
   dark-brand regression that shipped here for a month would fail this.
3. **WCAG AA contrast** — every text / brand-on-surface pairing must clear 4.5:1,
   computed with the same OKLab→luminance math as the codebase contract test
   (`packages/presentation/src/__tests__/tokens.contract.test.ts`). The dark CTA
   label (white on cobalt-300) is a **known borderline** at ~3.97:1 — guarded at
   the 3:1 UI floor and *warned*, not failed, pending the owner palette decision
   in `Engineering Handoff.html` (item 2).

### Run

```bash
node scripts/token-drift-gate.cjs            # the gate (CI + pre-commit)
node scripts/token-drift-gate.cjs --writepin # adopt current mirror as baseline
```

Exit 0 = green; exit 1 = drift, with a per-failure report.

### Re-mirroring (the only way to change tokens)

When the codebase `tokens.css` changes, the mirror is re-cut, not hand-edited:

1. Copy the new semantic values from `packages/tokens/src/tokens.css` (the
   `@revealui/tokens` package; canonical Claude pack at
   `packages/tokens/design-context/`) into
   `reference/presentation-tokens.css` (the DS mirror drops the
   `@media (prefers-color-scheme)` auto-detect block — see the NOTE in that file).
2. `node scripts/token-drift-gate.cjs` — confirm value pins + contrast still pass.
3. `node scripts/token-drift-gate.cjs --writepin` — bump `MIRROR.sha256`.
4. Commit all three together. The diff *is* the review.

### Optional source pin (when the monorepo is reachable)

To also assert the mirror was cut from the pinned source revision:

```bash
export RVUI_TOKENS_SRC=/abs/path/to/packages/tokens/src/tokens.css
node scripts/token-drift-gate.cjs --writesourcepin   # once, to adopt baseline
node scripts/token-drift-gate.cjs                    # now fails if source moved
```

With no `RVUI_TOKENS_SRC` set (the common case in this standalone repo), the
source check is skipped and the mirror-internal checks still run.

### Wire it in

Pre-commit (Husky or equivalent) and CI, next to `check_design_system`:

```yaml
# .github/workflows/ds.yml (sketch)
- run: node scripts/token-drift-gate.cjs
```

This is the land-now minimum described in **`Spec · Token Drift Gate.html`**. The
`@revealui/tokens` package now ships its own equivalent: a committed
`design-context/` pack + `MANIFEST.sha256` drift gate (regenerated via
`pnpm --filter @revealui/tokens gen:manifest`, checked with
`gen:manifest:check`).

---

## `adherence-lint.cjs` — keep consuming surfaces on-system

Where the drift gate guards the **token mirror**, this guards the **code that
consumes it**. It scans app / artifact source for the off-system patterns the
three visual-drift audits named, so the fixes can't silently rot back in. The
magenta inline code, the hardcoded greys, and the Source Sans 3 docs type all
shipped because nothing checked them — the audits are snapshots; this is the gate.

### Rules

| id | severity | catches | fix | audit |
|---|---|---|---|---|
| `grey-hex` | error | hardcoded Tailwind greys (`#1f2937`, `#6b7280`, `#e8eaed`, `#1a1a2e`, …) | the matching `--rvui-*` / `--mkt-*` token | Dark-Mode Sweep substitution table |
| `off-token-color` | error | audit-named off-brand hexes (`#d63384` magenta; pre-v4 `#003e7a`/`#f0b519`; retired `#1a5f9b`) | the token or canonical sRGB (`#003d94`/`#eeb300`) | Docs D3 · Logos |
| `non-brand-font` | error | `Source Sans 3`, `Mona Sans`, `Geist`, `Roboto`, … in a font declaration | `Inter` / `'Inter Tight'` | Docs D1 |
| `eyebrow-tracking` | warn | `tracking-wider` on an `uppercase` label | `tracking-widest` (0.20em) | Marketing 2 & 7 |
| `eyebrow-tracking-css` | warn | `letter-spacing: 0.22em` | `var(--rvui-tracking-wide)` | Marketing 2 |
| `emerald-utility` | warn | new `bg/text/border-emerald-*` utilities | a `cobalt-*` / `--rvui-*` equivalent | CLAUDE.md token rules |
| `checkmark-glyph` | warn | unicode `✓`/`✗` | inline `<svg>` | voice rules |

Canonical brand hexes (`#003d94`, `#eeb300`) are **not** flagged — only the
retired pre-Cobalt-v4 values are. The font rule fires only on declarations
(`font-family`, `--font-*`), never on prose that merely mentions a typeface.

### Run

```bash
node scripts/adherence-lint.cjs <path> [<path> …]
node scripts/adherence-lint.cjs ../revealui/apps              # sweep all apps
node scripts/adherence-lint.cjs --json ../revealui/apps/docs  # machine-readable
node scripts/adherence-lint.cjs --warn ../revealui/apps       # report-only (first adoption)
```

Exit 0 = clean (or warnings only); exit 1 = at least one error. `--warn` forces
exit 0 for staged rollout; `--quiet` drops the per-file OK line.

### Suppressing a reviewed exception

Put an inline comment on the **same line** (works in `//`, `/* */`, `<!-- -->`):

```css
color: #1a1a2e; /* adherence-ignore: grey-hex — third-party embed, matches their chrome */
```

### Wire it in

```yaml
# .github/workflows/ds.yml (the real workflow ships in remediation/ds.yml)
- run: node design-system/scripts/token-drift-gate.cjs
- run: node design-system/scripts/adherence-lint.cjs --warn apps
```

Roll out with `--warn` first to drain the existing backlog (the docs + marketing
findings are already specced in `remediation/`), then flip to the failing mode
once the convergence patches land so new drift is caught at the door. The
complete, repo-convention-matching workflow (pinned action SHAs, the
`@revealui/tokens gen:manifest:check` SHA gate, contract tests) is in
**`remediation/ds.yml`** — drop it into the monorepo's `.github/workflows/`.
