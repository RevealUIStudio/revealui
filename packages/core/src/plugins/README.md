---
visibility: internal
status: verified
title: "Core plugins"
description: "First-party config-transform plugins. Canonical author guide is docs/PLUGINS.md."
category: reference
audience: maintainer
---

# `@revealui/core` plugins

Config-transform plugins for RevealUI. A plugin is `(config: Config) => Config`. `buildConfig` runs them synchronously after validation.

**Canonical author guide:** [`docs/PLUGINS.md`](../../../../docs/PLUGINS.md)

| Plugin | Export | Purpose |
|--------|--------|---------|
| Form builder | `formBuilderPlugin` | Adds `forms` + `form-submissions` collections |
| Nested docs | `nestedDocsPlugin` | Parent + breadcrumbs on named collections |
| Redirects | `redirectsPlugin` | Adds a `redirects` collection (301/302) |

```ts
import { formBuilderPlugin, nestedDocsPlugin, redirectsPlugin } from '@revealui/core/plugins'
```

Stability: Beta. See `docs/CORE_STABILITY.md`.
