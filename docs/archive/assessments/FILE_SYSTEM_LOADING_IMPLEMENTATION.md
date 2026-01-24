# File System Loading Implementation

**Date**: January 2025  
**Status**: ✅ **COMPLETE**

## Summary

Implemented file system loading for markdown files and created a Vite plugin to automatically copy documentation files to the public directory for serving.

## Implementation

### 1. Vite Plugin for File Copying

Created a custom Vite plugin (`docsCopyPlugin`) in `apps/docs/vite.config.ts` that:

- **Copies markdown files** from `docs/` to `apps/docs/public/docs/` during dev and build
- **Watches for changes** and automatically re-copies files when markdown files are modified
- **Ignores directories** like `archive/`, `node_modules/`, `.next/`, `dist/`
- **Preserves directory structure** so paths remain consistent

**Features**:
- Automatic copying on dev server start
- Hot module replacement - files update when changed
- Console logging for feedback
- Error handling for missing directories

### 2. Route Updates

Updated all route components to load markdown files from the public directory:

#### GuidesPage
- Loads guides from `/docs/guides/`
- Supports nested paths (e.g., `/guides/getting-started`)
- Falls back to placeholder if file not found
- Index page loads `docs/guides/README.md`

#### ApiPage
- Loads API docs from `/docs/api/`
- Handles package paths like `revealui-core/README.md`
- Index page shows package list
- Helpful error messages if docs not generated

#### ReferencePage
- Loads reference docs from `/docs/reference/`
- Falls back to placeholder content

### 3. Markdown Loading Utility

Enhanced `loadMarkdownFile()` function in `apps/docs/app/utils/markdown.ts`:

- **Fetches files** from public directory via HTTP
- **Normalizes paths** (ensures leading slash)
- **Provides helpful errors** with suggestions if file not found
- **Handles fetch errors** gracefully

## File Structure

```
apps/docs/
├── vite.config.ts          # Vite config with docsCopyPlugin
├── public/
│   └── docs/              # Copied markdown files (gitignored)
│       ├── guides/
│       ├── api/
│       └── reference/
├── app/
│   ├── routes/
│   │   ├── GuidesPage.tsx  # Loads from /docs/guides/
│   │   ├── ApiPage.tsx     # Loads from /docs/api/
│   │   └── ReferencePage.tsx
│   └── utils/
│       └── markdown.ts     # File loading utilities
└── package.json

docs/                       # Source documentation
├── guides/
├── api/
└── reference/
```

## How It Works

### Development Mode

1. **Server starts**: Vite plugin copies all markdown files to `public/docs/`
2. **File changes**: Watcher detects changes and re-copies files
3. **Routes load**: Components fetch files via `fetch()` from `/docs/...`
4. **Hot reload**: Browser refreshes when files update

### Build Mode

1. **Build starts**: Plugin copies files before build
2. **Files included**: Public directory is copied to `dist/`
3. **Static serving**: Files are served as static assets

## Usage

### Development

```bash
pnpm docs:dev
```

- Files are automatically copied when server starts
- Changes to markdown files trigger re-copy and reload

### Building

```bash
pnpm docs:build
```

- Files are copied during build
- Final site includes all markdown files in `dist/docs/`

## Path Resolution

### Guide Files

- `/guides` → `/docs/guides/README.md`
- `/guides/getting-started` → `/docs/guides/getting-started.md`
- `/guides/deployment/vercel` → `/docs/guides/deployment/vercel.md`

### API Files

- `/api` → `/docs/api/README.md`
- `/api/revealui-core` → `/docs/api/revealui-core/README.md`
- `/api/revealui-core/some-page` → `/docs/api/revealui-core/some-page.md`

### Reference Files

- `/reference` → `/docs/reference/README.md`

## Error Handling

If a file is not found:
- Routes show a helpful placeholder message
- Error message includes the expected path
- Suggests running `pnpm docs:generate:api` if API docs missing

## Known Limitations

1. **Archive files**: The `docs/archive/` directory is excluded (too large)
2. **File discovery**: No automatic file listing - relies on README.md files
3. **Large files**: Very large markdown files may load slowly

## Future Enhancements

1. **File listing**: Generate index pages automatically
2. **Search**: Implement client-side search over markdown content
3. **Caching**: Cache loaded markdown content in memory
4. **Prefetching**: Prefetch linked markdown files

## Testing

To test the implementation:

1. **Start dev server**:
   ```bash
   pnpm docs:dev
   ```

2. **Verify files copied**:
   Check `apps/docs/public/docs/` exists and contains files

3. **Navigate routes**:
   - http://localhost:3001/guides
   - http://localhost:3001/api
   - http://localhost:3001/reference

4. **Modify a markdown file**:
   Edit a file in `docs/guides/` and verify it updates in browser

---

**Status**: ✅ Complete and ready for use
