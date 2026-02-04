# Documentation App

This app serves the RevealUI documentation using Vite + React + React Router.

## Documentation Source of Truth

**IMPORTANT**: The documentation source of truth is `/docs` at the repository root.

- **Source**: `/docs/` (repository root)
- **Generated**: `/apps/docs/public/docs/` (build artifact, gitignored)
- **Build Output**: `/apps/docs/dist/docs/` (build artifact, gitignored)

### Documentation Workflow

1. **Edit documentation**: Only edit files in `/docs/` directory
2. **Build/dev**: Run `pnpm dev` or `pnpm build` - docs are automatically copied
3. **Never edit**: Do not edit files in `apps/docs/public/docs/` or `apps/docs/dist/docs/`

The copy happens automatically via `scripts/copy-docs.sh` when you run:
- `pnpm dev` - Copies docs and starts dev server
- `pnpm build` - Copies docs and builds for production

## Development

```bash
# Start dev server (auto-copies docs from /docs)
pnpm dev

# Build for production (auto-copies docs from /docs)
pnpm build

# Preview production build
pnpm preview
```

## Structure

```
apps/docs/
├── public/
│   └── docs/          # Generated (gitignored) - DO NOT EDIT
├── dist/
│   └── docs/          # Build output (gitignored) - DO NOT EDIT
├── src/               # React app source
├── scripts/
│   └── copy-docs.sh   # Documentation copy script
└── package.json
```

## Testing

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with UI
pnpm test:ui
```

## Important Notes

- **Single Source of Truth**: All documentation lives in `/docs/` at repo root
- **Generated Directories**: `public/docs/` and `dist/docs/` are build artifacts
- **Gitignored**: Generated docs are not committed to version control
- **Build Process**: Docs are copied automatically during dev/build
- **Never Edit Generated**: Changes to generated docs will be overwritten

## Troubleshooting

### Docs not updating in dev server

1. Stop the dev server
2. Run `bash scripts/copy-docs.sh` manually
3. Restart dev server

### Docs missing in build

Ensure the build script runs successfully:
```bash
bash scripts/copy-docs.sh
```

Check that source docs exist:
```bash
ls -la ../../docs/
```
