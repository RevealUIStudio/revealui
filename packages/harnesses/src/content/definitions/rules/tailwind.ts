import type { Rule } from '../../schemas/rule.js';

export const tailwindRule: Rule = {
  id: 'tailwind',
  tier: 'oss',
  name: 'Tailwind CSS v4 Conventions',
  description: 'Tailwind v4 syntax rules, v3→v4 migration gotchas, and shared config patterns',
  scope: 'project',
  preambleTier: 2,
  tags: ['css', 'tailwind', 'styling'],
  content: `# Tailwind CSS v4 Conventions

## Version

RevealUI uses **Tailwind CSS v4** (\`^4.1.18\`). All new code must use v4 patterns.

## Current State

The shared config in \`packages/dev/src/tailwind/\` uses a **v3 compatibility pattern** (JS config file + JS plugins). This works because Tailwind v4 auto-detects \`tailwind.config.ts\` and falls back to v3 behavior. Migration to native v4 CSS config is deferred to Phase 2.

## v4 Gotchas (Must Know)

### Import Syntax
\`\`\`css
/* CORRECT (v4) */
@import "tailwindcss";

/* WRONG (v3  -  deprecated) */
@tailwind base;
@tailwind components;
@tailwind utilities;
\`\`\`

### Custom Utilities
\`\`\`css
/* CORRECT (v4) */
@utility my-util {
  /* styles */
}

/* WRONG (v3) */
@layer utilities {
  .my-util { /* styles */ }
}
@layer components {
  .my-component { /* styles */ }
}
\`\`\`

### CSS Variable Syntax
\`\`\`html
<!-- CORRECT (v4)  -  parentheses -->
<div class="bg-(--brand-color)">

<!-- WRONG (v3)  -  square brackets -->
<div class="bg-[--brand-color]">
\`\`\`

### Important Modifier
\`\`\`html
<!-- CORRECT (v4)  -  at the end -->
<div class="bg-red-500!">

<!-- WRONG (v3)  -  at the start -->
<div class="bg-!red-500">
\`\`\`

### Default Behavior Changes
- **Border/ring color**: now \`currentColor\` (was \`gray-200\` in v3)
- **Ring width**: default is \`1px\` (was \`3px\` in v3)
- **\`hover:\`**: only applies on devices that support hover (no-touch)
- **Stacked variants**: apply left-to-right (reversed from v3)
- **\`space-*\` / \`divide-*\`**: selectors changed  -  prefer \`gap\` with flex/grid

### Transform Utilities
\`\`\`html
<!-- CORRECT (v4) -->
<div class="scale-none rotate-none translate-none">

<!-- WRONG (v3) -->
<div class="transform-none">
\`\`\`

### Prefix Syntax
\`\`\`css
/* v4 prefix */
@import "tailwindcss" prefix(tw);
/* Classes use tw:bg-red-500 */
\`\`\`

### CSS Modules / Component Styles
Use \`@reference\` to access theme variables in CSS modules or component \`<style>\` blocks.

### PostCSS Plugin
\`\`\`js
// v4  -  new package name
{ plugins: { '@tailwindcss/postcss': {} } }

// v3  -  old (still works but deprecated)
{ plugins: { tailwindcss: {} } }
\`\`\`

### Vite Plugin (preferred over PostCSS for Vite apps)
\`\`\`js
import tailwindcss from '@tailwindcss/vite'
export default { plugins: [tailwindcss()] }
\`\`\`

## Theme Configuration (v4 native)

In v4, theme tokens go in CSS, not JS:

\`\`\`css
@import "tailwindcss";

@theme {
  --color-brand: #ea580c;
  --font-sans: "Inter", sans-serif;
  --breakpoint-xs: 475px;
  --breakpoint-3xl: 1920px;
}
\`\`\`

## RevealUI Shared Config

| File | Purpose |
|------|---------|
| \`packages/dev/src/tailwind/tailwind.config.ts\` | Shared v3-compat config (fonts, plugins, screens) |
| \`packages/dev/src/tailwind/create-config.ts\` | Helper to merge shared + app configs |
| \`packages/dev/src/tailwind/postcss.config.ts\` | PostCSS config with \`@tailwindcss/postcss\` |
| \`packages/dev/src/tailwind/styles.css\` | Base CSS (\`@import "tailwindcss"\`) |

### Consumer Pattern (current  -  v3 compat)
\`\`\`ts
// apps/admin/tailwind.config.ts
import { createTailwindConfig } from '@revealui/dev/tailwind/create-config'
export default createTailwindConfig({
  content: ['./src/**/*.{ts,tsx}'],
  // app-specific overrides
})
\`\`\`

## Rules for New Code

1. **Never use \`@tailwind\` directives**  -  use \`@import "tailwindcss"\` instead
2. **Never use \`@layer utilities\` or \`@layer components\`** for custom utilities  -  use \`@utility\`
3. **Use \`bg-(--var)\` syntax** for CSS variables, not \`bg-[--var]\`
4. **Important goes at the end**: \`bg-red-500!\` not \`!bg-red-500\`
5. **Prefer \`gap\`** over \`space-*\` / \`divide-*\` for spacing in flex/grid
6. **No \`transform-none\`**  -  use \`scale-none\`, \`rotate-none\`, \`translate-none\`
7. **Don't add new v3 JS plugins**  -  if a v4 CSS equivalent exists, use that
8. **Content paths are auto-detected** in v4  -  only add manual paths for edge cases`,
};
