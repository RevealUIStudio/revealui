# Tailwind CSS v4 Documentation Skill

## Purpose

Agent-optimized access to Tailwind CSS v4 documentation for answering questions, selecting utilities/variants, configuring Tailwind v4, and avoiding v3→v4 migration pitfalls.

## Quick Start

1. Check if docs snapshot exists: `references/docs/` should contain ~194 MDX files
2. If missing or stale, initialize: `python3 scripts/sync_tailwind_docs.py --accept-docs-license`
3. Identify the topic category from `references/docs-index.tsx`
4. Load the relevant MDX file from `references/docs/`
5. Always cross-check against `references/gotchas.md` for breaking changes

## References

| Path | Description |
|------|-------------|
| `references/docs/` | Generated MDX docs snapshot (gitignored) |
| `references/docs-index.tsx` | Category and slug mapping (gitignored) |
| `references/docs-source.txt` | Upstream repo, commit, and date (gitignored) |
| `references/gotchas.md` | v4 migration pitfalls and breaking changes (committed) |

## MDX Handling

- Treat `export const` statements as metadata
- Treat JSX callouts (`<TipInfo>`, `<TipBad>`, `<TipGood>`) as guidance
- Code blocks contain working examples

## Common Entry Points

| Topic | File |
|-------|------|
| Migration from v3 | `upgrade-guide.mdx` |
| Configuration | `adding-custom-styles.mdx` |
| Theme | `theme.mdx` |
| Dark mode | `dark-mode.mdx` |
| Responsive | `responsive-design.mdx` |
| Hover/focus/state | `hover-focus-and-other-states.mdx` |

## Sync Command

```bash
python3 .claude/skills/tailwind-4-docs/scripts/sync_tailwind_docs.py --accept-docs-license
```

Based on [Lombiq/Tailwind-Agent-Skills](https://github.com/Lombiq/Tailwind-Agent-Skills) (BSD-3-Clause).
