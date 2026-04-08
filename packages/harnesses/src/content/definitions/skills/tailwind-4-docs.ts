import type { Skill } from '../../schemas/skill.js';

export const tailwind4DocsSkill: Skill = {
  id: 'tailwind-4-docs',
  tier: 'oss',
  name: 'Tailwind CSS v4 Documentation',
  description:
    'Agent-optimized access to Tailwind CSS v4 documentation for answering questions, selecting utilities/variants, configuring Tailwind v4, and avoiding v3→v4 migration pitfalls.',
  disableModelInvocation: false,
  skipFrontmatter: true,
  filePatterns: [],
  bashPatterns: [],
  references: {
    gotchas: `# Tailwind CSS v4 Gotchas (Quick Scan)

- Browser support is modern-only: Safari 16.4+, Chrome 111+, Firefox 128+.
- PostCSS plugin moved to \`@tailwindcss/postcss\`.
- CLI moved to \`@tailwindcss/cli\`.
- Vite plugin \`@tailwindcss/vite\` is recommended.
- Import Tailwind with \`@import "tailwindcss";\` (no \`@tailwind\` directives).
- Prefix syntax is \`@import "tailwindcss" prefix(tw);\` and classes use \`tw:\` at the start.
- Important modifier goes at the end: \`bg-red-500!\`.
- Utility renames and removals: see \`references/docs/upgrade-guide.mdx\` for the full list.
- Default border and ring color now use \`currentColor\`; ring width default is 1px.
- \`space-*\` and \`divide-*\` selectors changed; use flex/grid with \`gap\` if layouts break.
- Custom utilities should use \`@utility\` instead of \`@layer utilities\` or \`@layer components\`.
- Stacked variants apply left-to-right (reverse order from v3).
- Arbitrary CSS variable syntax is \`bg-(--brand-color)\` (not \`bg-[--brand-color]\`).
- Transform reset uses \`scale-none\`, \`rotate-none\`, \`translate-none\` (not \`transform-none\`).
- \`hover:\` now only applies on devices that support hover; override if needed.
- CSS modules and component \`<style>\` blocks need \`@reference\` to access theme vars.`,
  },
  content: `# Tailwind CSS v4 Documentation Skill

## Purpose

Agent-optimized access to Tailwind CSS v4 documentation for answering questions, selecting utilities/variants, configuring Tailwind v4, and avoiding v3→v4 migration pitfalls.

## Quick Start

1. Check if docs snapshot exists: \`references/docs/\` should contain ~194 MDX files
2. If missing or stale, initialize: \`python3 scripts/sync_tailwind_docs.py --accept-docs-license\`
3. Identify the topic category from \`references/docs-index.tsx\`
4. Load the relevant MDX file from \`references/docs/\`
5. Always cross-check against \`references/gotchas.md\` for breaking changes

## References

| Path | Description |
|------|-------------|
| \`references/docs/\` | Generated MDX docs snapshot (gitignored) |
| \`references/docs-index.tsx\` | Category and slug mapping (gitignored) |
| \`references/docs-source.txt\` | Upstream repo, commit, and date (gitignored) |
| \`references/gotchas.md\` | v4 migration pitfalls and breaking changes (committed) |

## MDX Handling

- Treat \`export const\` statements as metadata
- Treat JSX callouts (\`<TipInfo>\`, \`<TipBad>\`, \`<TipGood>\`) as guidance
- Code blocks contain working examples

## Common Entry Points

| Topic | File |
|-------|------|
| Migration from v3 | \`upgrade-guide.mdx\` |
| Configuration | \`adding-custom-styles.mdx\` |
| Theme | \`theme.mdx\` |
| Dark mode | \`dark-mode.mdx\` |
| Responsive | \`responsive-design.mdx\` |
| Hover/focus/state | \`hover-focus-and-other-states.mdx\` |

## Sync Command

\`\`\`bash
python3 .claude/skills/tailwind-4-docs/scripts/sync_tailwind_docs.py --accept-docs-license
\`\`\`

Based on [Lombiq/Tailwind-Agent-Skills](https://github.com/Lombiq/Tailwind-Agent-Skills) (BSD-3-Clause).`,
};
