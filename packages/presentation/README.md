# @revealui/presentation

Shared UI components and presentation layer for RevealUI applications.

## Purpose

This package provides reusable UI components that can be shared across multiple apps in the RevealUI monorepo. It serves as the design system foundation for consistent UI across:

- `apps/cms` - CMS admin interface
- `apps/web` - Public-facing web application
- Future applications

## Structure

```
packages/presentation/
├── src/
│   ├── components/      # High-level, styled components
│   ├── primitives/     # Low-level, base components
│   └── index.ts        # Main entry point
├── package.json
├── tsconfig.json
└── README.md
```

## Usage

### In Apps

```typescript
// Import from the package
import { Button, Card } from '@revealui/presentation';

// Or import specific modules
import { Button } from '@revealui/presentation/components';
```

### Adding New Components

1. Create component in `src/components/` or `src/primitives/`
2. Export from the respective `index.ts` file
3. Re-export from main `src/index.ts` if needed
4. Build: `pnpm --filter @revealui/presentation build`

## Guidelines

- **Components**: High-level, styled, feature-complete components
- **Primitives**: Low-level, unstyled/minimally styled building blocks
- Use TypeScript for all components
- Follow React 19 patterns
- Support Tailwind CSS 4.0
- Ensure accessibility (WCAG 2.1)

## Development

```bash
# Build
pnpm --filter @revealui/presentation build

# Type check
pnpm --filter @revealui/presentation typecheck

# Watch mode
pnpm --filter @revealui/presentation dev
```
