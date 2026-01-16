# Complete Dependencies List

This document lists all dependencies and devDependencies from every package.json in the RevealUI project.

## Root (`package.json`)

### devDependencies
- `@biomejs/biome`: ^2.3.7
- `@changesets/cli`: ^2.29.7
- `@types/node`: ^24.10.1
- `@types/pg`: ^8.15.6
- `@types/react`: 19.2.7
- `@types/react-dom`: 19.2.3
- `cross-env`: ^10.1.0
- `dotenv`: ^17.2.3
- `dotenv-cli`: ^11.0.0
- `fast-glob`: ^3.3.3
- `pg`: ^8.16.3
- `tsx`: ^4.20.6
- `turbo`: ^2.7.2
- `typescript`: ^5.9.3
- `vercel-mcp`: ^0.0.7

---

## Apps

### `apps/cms` (`apps/cms/package.json`)

#### dependencies
- `@revealui/core`: workspace:*
- `@sentry/nextjs`: ^10.27.0
- `@stripe/stripe-js`: ^8.5.3
- `@supabase/supabase-js`: ^2.84.0
- `@tailwindcss/aspect-ratio`: ^0.4.2
- `@tailwindcss/forms`: ^0.5.11
- `@tailwindcss/typography`: ^0.5.19
- `@vercel/analytics`: ^1.5.0
- `@vercel/speed-insights`: ^1.2.0
- `babel-plugin-react-compiler`: 19.0.0-beta-63e3235-20250105
- `class-variance-authority`: ^0.7.1
- `cross-env`: ^10.1.0
- `geist`: ^1.5.1
- `jsonwebtoken`: ^9.0.2
- `lexical`: ^0.38.2
- `next`: 16.0.10
- `prism-react-renderer`: ^2.4.1
- `react`: 19.2.0
- `react-dom`: 19.2.0
- `react-hook-form`: ^7.66.1
- `sharp`: 0.34.5
- `stripe`: ^20.0.0
- `zod`: ^4.1.13

#### devDependencies
- `@tailwindcss/postcss`: ^4.1.17
- `@types/better-sqlite3`: ^7.6.13
- `@types/jsonwebtoken`: ^9.0.10
- `@vitest/coverage-v8`: ^4.0.14
- `@vitest/ui`: ^4.0.14
- `better-sqlite3`: ^12.4.6
- `dev`: workspace:*
- `dotenv`: ^17.2.3
- `eslint`: ^9.39.1
- `postcss`: ^8.5.6
- `rimraf`: ^6.1.2
- `services`: workspace:*
- `tailwindcss`: ^4.1.17
- `typescript`: ^5.9.3
- `vite`: ^7.2.4
- `vitest`: ^4.0.14

---

### `apps/web` (`apps/web/package.json`)

#### dependencies
- `@hono/node-server`: ^1.19.6
- `@sentry/react`: ^10.27.0
- `@universal-middleware/core`: ^0.4.13
- `@universal-middleware/hono`: ^0.4.17
- `@vercel/node`: ^5.5.12
- `@vitejs/plugin-react`: ^5.1.1
- `@vitejs/plugin-react-swc`: ^4.2.2
- `better-sqlite3`: ^12.4.6
- `cross-env`: ^10.1.0
- `dotenv`: ^17.2.3
- `drizzle-kit`: ^0.31.7
- `drizzle-orm`: ^0.44.7
- `hono`: ^4.10.7
- `react`: 19.2.0
- `react-dom`: 19.2.0
- `stripe`: ^20.0.0
- `vite`: ^7.2.4

#### devDependencies
- `@biomejs/biome`: 2.3.7
- `@eslint/js`: ^9.39.1
- `@hono/vite-dev-server`: ^0.23.0
- `@sentry/vite-plugin`: ^4.6.1
- `@types/better-sqlite3`: ^7.6.13
- `@types/node`: ^24.10.1
- `@types/react`: 19.2.7
- `@types/react-dom`: 19.2.3
- `babel-plugin-react-compiler`: 19.0.0-beta-63e3235-20250105
- `dev`: workspace:*
- `eslint`: ^9.39.1
- `eslint-plugin-react`: ^7.37.5
- `globals`: ^16.5.0
- `next`: 16.0.10
- `postcss`: ^8.5.6
- `sass`: ^1.94.2
- `tailwindcss`: ^4.1.17
- `tsx`: ^4.20.6
- `typescript`: ^5.9.3
- `typescript-eslint`: ^8.48.0
- `@revealui/core`: workspace:*

---

## Packages

### `packages/revealui` (`packages/revealui/package.json`)

#### dependencies
- `@lexical/clipboard`: ^0.38.2
- `@lexical/code`: ^0.38.2
- `@lexical/link`: ^0.38.2
- `@lexical/list`: ^0.38.2
- `@lexical/react`: ^0.38.2
- `@lexical/rich-text`: ^0.38.2
- `@lexical/selection`: ^0.38.2
- `@lexical/table`: ^0.38.2
- `@lexical/utils`: ^0.38.2
- `@revealui/schema`: workspace:*
- `@vercel/blob`: ^0.23.4
- `@vercel/postgres`: ^0.9.0
- `bcryptjs`: ^2.4.3
- `better-sqlite3`: ^12.4.6
- `dataloader`: ^2.2.2
- `deepmerge`: ^4.3.1
- `jsonwebtoken`: ^9.0.2
- `lexical`: ^0.38.2
- `pg`: ^8.16.3
- `sharp`: ^0.34.5
- `to-snake-case`: ^1.0.0
- `zod`: ^4.1.13

#### devDependencies
- `@types/bcryptjs`: ^2.4.6
- `@types/better-sqlite3`: ^7.6.13
- `@types/json-schema`: ^7.0.15
- `@types/jsonwebtoken`: ^9.0.10
- `@types/pg`: ^8.15.6
- `@types/to-snake-case`: ^1.0.2
- `tsup`: ^8.0.0

---

### `packages/db` (`packages/db/package.json`)

#### dependencies
- `@neondatabase/serverless`: ^0.10.1
- `@revealui/schema`: workspace:*
- `drizzle-orm`: ^0.35.2

#### devDependencies
- `@biomejs/biome`: ^2.3.7
- `drizzle-kit`: ^0.28.0
- `typescript`: ^5.5.3

---

### `packages/memory` (`packages/memory/package.json`)

#### dependencies
- `@revealui/db`: workspace:*
- `@revealui/schema`: workspace:*
- `drizzle-orm`: ^0.38.4
- `uuid`: ^11.1.0

#### devDependencies
- `@types/uuid`: ^10.0.0
- `typescript`: ^5.7.3
- `vitest`: ^3.0.0

---

### `packages/test` (`packages/test/package.json`)

#### dependencies
- `@revealui/core`: workspace:*
- `vite`: ^7.2.4

#### devDependencies
- `@playwright/test`: ^1.57.0
- `@testing-library/jest-dom`: ^6.9.1
- `@testing-library/react`: ^16.3.0
- `@testing-library/user-event`: ^14.6.1
- `@vitest/coverage-v8`: ^4.0.14
- `@vitest/ui`: ^4.0.14
- `jsdom`: ^27.2.0
- `vitest`: ^4.0.14

---

### `packages/dev` (`packages/dev/package.json`)

#### devDependencies
- `@biomejs/biome`: 2.3.7
- `@tailwindcss/aspect-ratio`: ^0.4.2
- `@tailwindcss/forms`: ^0.5.10
- `@tailwindcss/typography`: ^0.5.16
- `eslint`: ^9.39.1
- `tailwindcss`: ^4.1.17
- `typescript`: ^5.9.3

---

### `packages/schema` (`packages/schema/package.json`)

#### dependencies
- `zod`: ^4.3.4

#### devDependencies
- `@types/node`: ^22.0.0
- `typescript`: ^5.9.3
- `vitest`: ^2.1.0

---

### `packages/services` (`packages/services/package.json`)

#### dependencies
- `@supabase/ssr`: ^0.7.0
- `@supabase/supabase-js`: ^2.84.0
- `@vitejs/plugin-react-swc`: ^4.2.2
- `react`: 19.2.0
- `react-dom`: 19.2.0
- `stripe`: ^20.0.0
- `vite`: ^7.2.4

#### devDependencies
- `@typescript-eslint/eslint-plugin`: ^8.48.0
- `@typescript-eslint/parser`: ^8.48.0
- `dotenv`: ^17.2.3
- `eslint`: ^9.39.1
- `supabase`: ^2.62.5
- `typescript`: ^5.9.3

---

## Lexical Packages (Internal)

### `packages/revealui/src/lexical/lexical` (`packages/revealui/src/lexical/lexical/package.json`)
- No dependencies or devDependencies listed

---

### `packages/revealui/src/lexical/lexical-react` (`packages/revealui/src/lexical/lexical-react/package.json`)

#### dependencies
- `@floating-ui/react`: ^0.27.8
- `@lexical/devtools-core`: 0.35.0
- `@lexical/dragon`: 0.35.0
- `@lexical/hashtag`: 0.35.0
- `@lexical/history`: 0.35.0
- `@lexical/link`: 0.35.0
- `@lexical/list`: 0.35.0
- `@lexical/mark`: 0.35.0
- `@lexical/markdown`: 0.35.0
- `@lexical/overflow`: 0.35.0
- `@lexical/plain-text`: 0.35.0
- `@lexical/rich-text`: 0.35.0
- `@lexical/table`: 0.35.0
- `@lexical/text`: 0.35.0
- `@lexical/utils`: 0.35.0
- `@lexical/yjs`: 0.35.0
- `lexical`: 0.35.0
- `react-error-boundary`: ^3.1.4

#### devDependencies
- `@types/jest-axe`: ^3.5.9
- `jest-axe`: ^10.0.0

---

### `packages/revealui/src/lexical/lexical-yjs` (`packages/revealui/src/lexical/lexical-yjs/package.json`)

#### dependencies
- `@lexical/offset`: 0.35.0
- `@lexical/selection`: 0.35.0
- `lexical`: 0.35.0

---

### `packages/revealui/src/lexical/lexical-rich-text` (`packages/revealui/src/lexical/lexical-rich-text/package.json`)

#### dependencies
- `@lexical/clipboard`: 0.35.0
- `@lexical/selection`: 0.35.0
- `@lexical/utils`: 0.35.0
- `lexical`: 0.35.0

---

### `packages/revealui/src/lexical/lexical-code` (`packages/revealui/src/lexical/lexical-code/package.json`)

#### dependencies
- `@lexical/utils`: 0.35.0
- `lexical`: 0.35.0
- `prismjs`: ^1.30.0

#### devDependencies
- `@types/prismjs`: ^1.26.0

---

### `packages/revealui/src/lexical/shared` (`packages/revealui/src/lexical/shared/package.json`)

#### dependencies
- `lexical`: 0.35.0

---

### `packages/revealui/src/lexical/lexical-clipboard` (`packages/revealui/src/lexical/lexical-clipboard/package.json`)

#### dependencies
- `@lexical/html`: 0.35.0
- `@lexical/list`: 0.35.0
- `@lexical/selection`: 0.35.0
- `@lexical/utils`: 0.35.0
- `lexical`: 0.35.0

---

### `packages/revealui/src/lexical/lexical-selection` (`packages/revealui/src/lexical/lexical-selection/package.json`)

#### dependencies
- `lexical`: 0.35.0

---

### `packages/revealui/src/lexical/lexical-devtools` (`packages/revealui/src/lexical/lexical-devtools/package.json`)

#### dependencies
- `@chakra-ui/react`: ^2.8.2
- `@emotion/react`: ^11.11.4
- `@emotion/styled`: ^11.11.5
- `@webext-pegasus/rpc`: ^0.3.0
- `@webext-pegasus/store-zustand`: ^0.3.0
- `@webext-pegasus/transport`: ^0.3.0
- `framer-motion`: ^11.1.5
- `react`: ^18.2.0
- `react-dom`: ^18.2.0
- `zustand`: ^4.5.1

#### devDependencies
- `@babel/plugin-transform-flow-strip-types`: ^7.24.7
- `@babel/preset-react`: ^7.24.7
- `@lexical/devtools-core`: 0.35.0
- `@rollup/plugin-babel`: ^6.0.4
- `@types/react`: ^18.2.46
- `@types/react-dom`: ^18.2.18
- `@vitejs/plugin-react`: ^4.2.1
- `lexical`: 0.35.0
- `typescript`: ^5.4.5
- `vite`: ^5.2.2
- `wxt`: ^0.17.0

---

### `packages/revealui/src/lexical/lexical-history` (`packages/revealui/src/lexical/lexical-history/package.json`)

#### dependencies
- `@lexical/utils`: 0.35.0
- `lexical`: 0.35.0

---

### `packages/revealui/src/lexical/lexical-devtools-core` (`packages/revealui/src/lexical/lexical-devtools-core/package.json`)

#### dependencies
- `@lexical/html`: 0.35.0
- `@lexical/link`: 0.35.0
- `@lexical/mark`: 0.35.0
- `@lexical/table`: 0.35.0
- `@lexical/utils`: 0.35.0
- `lexical`: 0.35.0

---

### `packages/revealui/src/lexical/lexical-overflow` (`packages/revealui/src/lexical/lexical-overflow/package.json`)

#### dependencies
- `lexical`: 0.35.0

---

### `packages/revealui/src/lexical/lexical-code-shiki` (`packages/revealui/src/lexical/lexical-code-shiki/package.json`)

#### dependencies
- `@lexical/code`: 0.35.0
- `@lexical/utils`: 0.35.0
- `@shikijs/core`: ^3.7.0
- `@shikijs/engine-javascript`: ^3.7.0
- `@shikijs/langs`: ^3.7.0
- `@shikijs/themes`: ^3.7.0
- `lexical`: 0.35.0
- `shiki`: ^3.7.0

#### devDependencies
- `@shikijs/types`: ^3.7.0

---

### `packages/revealui/src/lexical/lexical-file` (`packages/revealui/src/lexical/lexical-file/package.json`)

#### dependencies
- `lexical`: 0.35.0

---

### `packages/revealui/src/lexical/lexical-offset` (`packages/revealui/src/lexical/lexical-offset/package.json`)

#### dependencies
- `lexical`: 0.35.0

---

### `packages/revealui/src/lexical/lexical-headless` (`packages/revealui/src/lexical/lexical-headless/package.json`)

#### dependencies
- `lexical`: 0.35.0

---

### `packages/revealui/src/lexical/lexical-utils` (`packages/revealui/src/lexical/lexical-utils/package.json`)

#### dependencies
- `@lexical/list`: 0.35.0
- `@lexical/selection`: 0.35.0
- `@lexical/table`: 0.35.0
- `lexical`: 0.35.0

---

### `packages/revealui/src/lexical/lexical-eslint-plugin` (`packages/revealui/src/lexical/lexical-eslint-plugin/package.json`)

#### devDependencies
- `@types/eslint`: ^8.56.9

---

### `packages/revealui/src/lexical/lexical-html` (`packages/revealui/src/lexical/lexical-html/package.json`)

#### dependencies
- `@lexical/selection`: 0.35.0
- `@lexical/utils`: 0.35.0
- `lexical`: 0.35.0

---

### `packages/revealui/src/lexical/lexical-mark` (`packages/revealui/src/lexical/lexical-mark/package.json`)

#### dependencies
- `@lexical/utils`: 0.35.0
- `lexical`: 0.35.0

---

### `packages/revealui/src/lexical/lexical-table` (`packages/revealui/src/lexical/lexical-table/package.json`)

#### dependencies
- `@lexical/clipboard`: 0.35.0
- `@lexical/utils`: 0.35.0
- `lexical`: 0.35.0

---

### `packages/revealui/src/lexical/lexical-dragon` (`packages/revealui/src/lexical/lexical-dragon/package.json`)

#### dependencies
- `lexical`: 0.35.0

---

### `packages/revealui/src/lexical/lexical-text` (`packages/revealui/src/lexical/lexical-text/package.json`)

#### dependencies
- `lexical`: 0.35.0

---

### `packages/revealui/src/lexical/lexical-plain-text` (`packages/revealui/src/lexical/lexical-plain-text/package.json`)

#### dependencies
- `@lexical/clipboard`: 0.35.0
- `@lexical/selection`: 0.35.0
- `@lexical/utils`: 0.35.0
- `lexical`: 0.35.0

---

### `packages/revealui/src/lexical/lexical-link` (`packages/revealui/src/lexical/lexical-link/package.json`)

#### dependencies
- `@lexical/utils`: 0.35.0
- `lexical`: 0.35.0

---

### `packages/revealui/src/lexical/lexical-hashtag` (`packages/revealui/src/lexical/lexical-hashtag/package.json`)

#### dependencies
- `@lexical/utils`: 0.35.0
- `lexical`: 0.35.0

---

### `packages/revealui/src/lexical/lexical-list` (`packages/revealui/src/lexical/lexical-list/package.json`)

#### dependencies
- `@lexical/selection`: 0.35.0
- `@lexical/utils`: 0.35.0
- `lexical`: 0.35.0

---

### `packages/revealui/src/lexical/lexical-markdown` (`packages/revealui/src/lexical/lexical-markdown/package.json`)

#### dependencies
- `@lexical/code`: 0.35.0
- `@lexical/link`: 0.35.0
- `@lexical/list`: 0.35.0
- `@lexical/rich-text`: 0.35.0
- `@lexical/text`: 0.35.0
- `@lexical/utils`: 0.35.0
- `lexical`: 0.35.0

---

## Summary Statistics

- **Total package.json files**: 38
- **Root packages**: 1
- **App packages**: 2 (cms, web)
- **Main packages**: 7 (revealui, db, memory, test, dev, schema, services)
- **Lexical packages**: 28

---

## Related Documentation

- [Component Mapping](./COMPONENT-MAPPING.md) - Component, business logic, schema mapping
- [Frameworks List](./FRAMEWORKS-LIST.md) - Framework usage
- [Package Conventions](../../packages/PACKAGE-CONVENTIONS.md) - Package structure
- [Master Index](../INDEX.md) - Complete documentation index
- [Task-Based Guide](../TASKS.md) - Find docs by task

---

*Generated from all package.json files in the RevealUI monorepo*
