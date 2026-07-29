# RevealUI Docs

Public documentation site for RevealUI  -  built with Vite and React.

**Live at:** https://docs.revealui.com

## Features

- **Markdown Rendering**  -  Renders project documentation as styled HTML (react-markdown + remark-gfm)
- **Content Pipeline**  -  `scripts/copy-docs.sh` copies **public** docs from monorepo `docs/` into `public/` at build time (flat URL space per CHIP-3 D5a — `docs.revealui.com/admin-guide` resolves to `public/ADMIN_GUIDE.md`)
- **Visibility Filtering**  -  Fail-closed on frontmatter `visibility: public` only (internal docs stay in `docs/` and never ship)
- **SPA Routing**  -  Client-side routing via @revealui/router with Vercel SPA rewrite

## Stack

- **Build**: Vite
- **UI**: React 19
- **Markdown**: react-markdown, remark-gfm
- **Routing**: @revealui/router

## Development

```bash
# Start dev server (copies docs + starts Vite)
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview

# Type check
pnpm typecheck

# Run tests
pnpm test
```

## Content Pipeline (single source of truth)

| Path | Role |
|------|------|
| **`docs/`** (monorepo root) | **Only place to edit** documentation |
| **`apps/docs/public/**/*.md`** | **Generated serve mirror** — do not edit, gitignored |
| **`apps/docs/public/docs-pro/`** | Hand-authored Pro docs exception (tracked) |

`scripts/copy-docs.sh` (and the Vite `docsCopyPlugin`) copy markdown from monorepo `docs/` into `public/` (flat root, not `public/docs/`) before each build. After copy, `prune-non-public.mjs` removes anything that is not `visibility: public`. See CHIP-3 D5a in `scripts/copy-docs.sh` and `public/COPIED-FROM-DOCS.txt`.

**Agents and humans:** always edit under monorepo `docs/`. Never open a PR that only changes `apps/docs/public/*.md`. A local `public/` tree after `pnpm dev` is build output, not a second docs set.

## Deployment

Deployed to Vercel as `revealui-docs` via CLI (not GitHub auto-deploy).

```bash
# Deploy from repo root
VERCEL_ORG_ID=<org-id> \
VERCEL_PROJECT_ID=<project-id> \
vercel deploy --prod --archive=tgz
```

## Related

- [Architecture Guide](../../docs/ARCHITECTURE.md)

## License

MIT
