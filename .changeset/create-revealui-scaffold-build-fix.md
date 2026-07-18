---
"@revealui/cli": patch
---

fix the four Next.js scaffold templates (starter, basic-blog, e-commerce, portfolio) so `pnpm build` succeeds out of the box with no manual dependency additions and no network self-healing:

- declare `babel-plugin-react-compiler` as a devDependency. `next.config.mjs` sets `reactCompiler: true`, but Next lists the plugin only as an optional peer dependency, so pnpm never installed it and `pnpm build` failed with "Failed to resolve package babel-plugin-react-compiler".
- declare `@types/react` and `@types/node` as devDependencies so an offline or `--frozen-lockfile` build doesn't depend on Next auto-installing them at build time.

`starter-native` (Vite, not Next) is unaffected.
