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

1. Copy the new semantic values from `packages/presentation/src/tokens.css` into
   `reference/presentation-tokens.css` (the DS mirror drops the
   `@media (prefers-color-scheme)` auto-detect block — see the NOTE in that file).
2. `node scripts/token-drift-gate.cjs` — confirm value pins + contrast still pass.
3. `node scripts/token-drift-gate.cjs --writepin` — bump `MIRROR.sha256`.
4. Commit all three together. The diff *is* the review.

### Optional source pin (when the monorepo is reachable)

To also assert the mirror was cut from the pinned source revision:

```bash
export RVUI_TOKENS_SRC=/abs/path/to/packages/presentation/src/tokens.css
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

This is the land-now minimum described in **`Spec · Token Drift Gate.html`**; it
folds into `@revealui/tokens` if/when the **Component Library Plan** ships.
