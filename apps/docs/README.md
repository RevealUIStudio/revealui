# RevealUI Docs

Public documentation site for RevealUI  -  built with Vite and React.

**Live at:** https://docs.revealui.com

## Features

- **Markdown Rendering**  -  Renders project documentation as styled HTML (react-markdown + remark-gfm)
- **Content Pipeline**  -  `scripts/copy-docs.sh` copies user-facing docs from the monorepo root into `public/docs/` at build time
- **Security Filtering**  -  Internal docs (MASTER_PLAN, GOVERNANCE, AI-AGENT-RULES, etc.) are excluded from the public build
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

## Content Pipeline

The docs app doesn't have its own source content. Instead, `scripts/copy-docs.sh` copies markdown files from the monorepo `docs/` directory into `public/docs/` before each build. Internal-only documents are filtered out.

To add new public documentation, add markdown files to the monorepo `docs/` directory. To exclude a file from the public build, add it to the exclusion list in `scripts/copy-docs.sh`.

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
