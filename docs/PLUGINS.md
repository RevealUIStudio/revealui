---
visibility: public
status: verified
title: "Plugins"
description: "Author and configure RevealUI config-transform plugins, including the three first-party plugins"
category: guide
audience: developer
---

RevealUI plugins are functions that transform a `Config` object before the runtime starts. They add collections, fields, hooks, or endpoints. They do not replace the Hono API and they are not a marketplace.

**Stability:** Beta. The `Plugin` function shape is stable (`(config: Config) => Config`). Async plugins are rejected by `buildConfig`. The set of bundled plugins may grow before 1.0. See [Core Stability](./CORE_STABILITY.md#plugins).

Import: `@revealui/core/plugins`.

---

## What a plugin is

```ts
import type { Config } from '@revealui/contracts/admin'

export type Plugin = (config: Config) => Config | Promise<Config>
```

`buildConfig` in `@revealui/core` validates the incoming config, applies defaults, then runs each plugin in array order and assigns the returned object onto the config. If a plugin returns a Promise, `buildConfig` throws: `Async plugins are not supported in buildConfig.`

```ts
import { buildConfig } from '@revealui/core/config'
import { formBuilderPlugin, nestedDocsPlugin, redirectsPlugin } from '@revealui/core/plugins'

const config = buildConfig({
  secret: process.env.REVEALUI_SECRET ?? '',
  collections: [/* your collections */],
  plugins: [
    formBuilderPlugin(),
    nestedDocsPlugin({ collections: ['pages'] }),
    redirectsPlugin({ collections: ['pages', 'posts'] }),
  ],
})
```

`PluginOptions` is an open `Record<string, unknown>` bag. First-party plugins use their own typed config interfaces instead.

---

## Lifecycle

1. You pass `plugins: Plugin[]` on the root config.
2. `buildConfig` validates structure via `@revealui/contracts`.
3. Defaults merge in (`serverURL`, admin import map, TypeScript output, localization).
4. Each plugin runs synchronously and may mutate or replace collections, globals, hooks, or `custom`.
5. The returned config is what the admin and collection operations see.

There is no enable/disable registry, no sandbox, and no permission model for untrusted plugins. Load only code you trust.

---

## First-party plugins

All three live in `packages/core/src/plugins/` and ship with `@revealui/core`.

### form-builder

Adds `forms` and `form-submissions` collections so editors can define fields and store submissions in admin.

**When to use:** contact forms, waitlists, or any structured intake that should be edited without a deploy.

```ts
import { formBuilderPlugin } from '@revealui/core/plugins'

formBuilderPlugin({
  fields: { payment: false },
  formOverrides: {
    slug: 'forms',
    admin: { useAsTitle: 'title' },
  },
})
```

Default form fields include `title`, a `fields` array (text, email, textarea, checkbox, select, radio, number, date, phone, country), confirmation message, redirect, and notification emails. Tests: `packages/core/src/plugins/__tests__/form-builder.test.ts`.

### nested-docs

Adds a parent relationship and a read-only breadcrumbs array to named collections. Breadcrumb walk uses the Drizzle client you pass in; without `getDb`, breadcrumbs stay empty.

**When to use:** page trees, nested categories, any collection that needs a parent pointer.

```ts
import { nestedDocsPlugin } from '@revealui/core/plugins'

nestedDocsPlugin({
  collections: ['pages'],
  parentFieldSlug: 'parent',
  breadcrumbsFieldSlug: 'breadcrumbs',
  labelField: 'title',
  getDb: () => db,
})
```

Identifier names (collection slug, field slugs) must be SQL-safe (`[A-Za-z_][A-Za-z0-9_]*`). Invalid names skip the breadcrumb walk.

### redirects

Adds a `redirects` collection (`from`, `to`, `status` 301/302). `to` is a relationship to the collections you name (default `pages` and `posts`).

**When to use:** CMS-managed URL redirects.

```ts
import { redirectsPlugin } from '@revealui/core/plugins'

redirectsPlugin({
  collections: ['pages', 'posts'],
})
```

Field and hook overrides are available via `overrides.fields` and `overrides.hooks.afterChange`.

---

## Authoring a plugin

1. Export a factory that returns a `Plugin`.
2. Take a typed options object; default every optional field.
3. Return a new config (or the same object after in-place collection edits). Do not start servers or open sockets inside the plugin.
4. Keep the plugin synchronous.
5. Put tests next to the plugin: `packages/core/src/plugins/__tests__/<name>.test.ts`.

House conventions used by the first-party plugins:

- File name is kebab-case (`form-builder.ts`).
- Export is `<name>Plugin` (`formBuilderPlugin`).
- Config interface is `<Name>PluginConfig`.
- Re-export from `packages/core/src/plugins/index.ts` and from the `@revealui/core/plugins` subpath.

### Example: add a `/health` collection endpoint

The Hono API already serves `GET /health` at the server layer. This example shows the plugin API only: a hidden collection plus a root endpoint you can copy into a local config.

```ts
import type { Plugin } from '@revealui/core'

export function healthPlugin(): Plugin {
  return (config) => ({
    ...config,
    collections: [
      ...(config.collections ?? []),
      {
        slug: 'health-checks',
        admin: { hidden: true },
        fields: [{ name: 'ok', type: 'checkbox', defaultValue: true }],
        endpoints: [
          {
            path: '/health',
            method: 'get',
            root: true,
            handler: () =>
              Response.json({ ok: true, at: new Date().toISOString() }),
          },
        ],
      },
    ],
  })
}
```

Wire it with `plugins: [healthPlugin()]` and run `buildConfig`. If the endpoint does not appear, confirm you called `buildConfig` (plugins do not run on a raw object).

---

## Testing a plugin

Call the plugin with a minimal config and assert on the returned collections:

```ts
import { describe, expect, it } from 'vitest'
import { formBuilderPlugin } from '@revealui/core/plugins'

describe('formBuilderPlugin', () => {
  it('adds forms and form-submissions', () => {
    const result = formBuilderPlugin()({ collections: [] })
    const slugs = result.collections?.map((c) => c.slug) ?? []
    expect(slugs).toContain('forms')
    expect(slugs).toContain('form-submissions')
  })
})
```

---

## Publishing a plugin

There is no plugin marketplace. Publish a plugin the same way you publish any TypeScript package: npm (or a private registry), MIT or your chosen license, and a README that names the `@revealui/core` version you tested against. Third-party publish, discovery, and payouts are Planned ([ROADMAP](./ROADMAP.md), [#526](https://github.com/RevealUIStudio/revealui/issues/526)).

---

## Known limitations

- Async plugins throw at `buildConfig`.
- No isolation. A plugin can rewrite any collection.
- No version compatibility matrix yet. Treat the API as pre-1.0 Beta.
- Collection `endpoints` are a config-layer hook. They are not a substitute for routes in `apps/server`.
- The admin Hono/Next health surfaces (`GET /health`, `GET /health/ready`) are server code, not this plugin API.

---

## Related

- [Core Stability — Plugins](./CORE_STABILITY.md#plugins)
- [Package source](https://github.com/RevealUIStudio/revealui/tree/test/packages/core/src/plugins)
- [Admin development](./guides/admin-dev.md)
- [Errors and debugging](./guides/errors-and-debugging.md)
