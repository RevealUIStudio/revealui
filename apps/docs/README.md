# RevealUI Docs

Public documentation site for RevealUI — built with Vite and React.

**Live at:** https://docs.revealui.com

## Documentation SoT (read this first)

| Path | Role |
|------|------|
| **`docs/`** (monorepo root) | **Only place to edit** documentation |
| **`apps/docs/public/**/*.md`** | **Do not create.** Not a materialize mirror. |
| **`apps/docs/public/docs-pro/`** | Hand-authored Pro docs exception (tracked) |
| **`apps/docs/dist/**/*.md`** | Build output only (gitignored) |

Publish plane: `scripts/docs-publish.mjs` + Vite `docs-publish` plugin.

- **Dev:** middleware serves `visibility: public` markdown from monorepo `docs/`
- **Build:** emits the same set into `dist/` for static hosting
- **Visibility:** fail-closed frontmatter (`scripts/served-docs.mjs`)

See `public/DOCS-PUBLISH-PLANE.txt` and  
`docs/decisions/2026-07-29-docs-publish-plane-virtual-serve.md`.

## Features

- **Markdown rendering** — react-markdown + remark-gfm
- **Virtual publish plane** — no second authoring-shaped tree under `public/`
- **Visibility filtering** — fail-closed `visibility: public` only
- **SPA routing** — `@revealui/router` with Vercel SPA rewrite
- **Flat URLs** — CHIP-3 D5a (`docs.revealui.com/admin-guide` → `ADMIN_GUIDE.md`)

## Stack

- Build: Vite
- UI: React 19
- Markdown: react-markdown, remark-gfm
- Routing: `@revealui/router`

## Development

```bash
# Start dev server (virtual serve from monorepo docs/)
pnpm dev

# Production build (emits public md into dist/)
pnpm build

# Link integrity (served set = visibility:public under monorepo docs/)
pnpm check:links

# Clean leftover generated public/*.md from old materialize builds
pnpm clean:public-mirror

pnpm typecheck
pnpm test
```

## Adding documentation

1. Add or edit markdown under monorepo **`docs/`**
2. Set frontmatter `visibility: public` to ship on docs.revealui.com
3. Internal docs use `visibility: internal` (never served)
4. Re-run `pnpm build:slug-manifest` when adding/renaming public paths that affect slugs

Do **not** add markdown under `apps/docs/public/` except `docs-pro/`.

## Deployment

Deployed to Vercel as `revealui-docs`.

```bash
pnpm vercel-build   # from apps/docs: turbo build --filter=docs
```
