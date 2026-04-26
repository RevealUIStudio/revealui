# Editor Config Sync — see RevCon

> **This page redirects.** Editor configuration sync is **not** an `@revealui/editors` package inside this monorepo. It ships as a separate suite product called **RevCon**, distributed standalone and used independently of any RevealUI license.

## Where it lives

- **Repo:** [RevealUIStudio/revcon](https://github.com/RevealUIStudio/revcon)
- **CLI:** `pnpm dlx revcon sync` (or install with `pnpm add -D @revealui/revcon` once published)
- **License:** RevCon is intentionally decoupled from the RevealUI runtime — editor profiles evolve on a different cadence than the CMS/API packages and are not gated by the Pro license.

## What RevCon does

- Syncs editor configs across **VS Code**, **Zed**, **Cursor**, and supported agent shells
- Distributes Claude Code rules, Cursor rules, agent skill files, and shell snippets across all repos in the suite via `link.sh`
- Validates frontmatter on agent/skill `.md`/`.mdc` files
- Provides per-profile overrides (e.g. `revealui` profile) so a developer can swap conventions per project

## Why it's a separate product

The `@revealui/editors` listing in earlier versions of this docs site referred to an in-monorepo package that does not exist. The functionality always lived in RevCon, which sits alongside RevealUI in the [RevealUI Studio Suite](https://github.com/RevealUIStudio).

## Quick start

```bash
# From any repo where you want suite-aligned editor configs
pnpm dlx revcon sync

# Or, if RevCon is checked out alongside this repo
~/suite/revcon/link.sh
```

## Related

- [RevCon README](https://github.com/RevealUIStudio/revcon/blob/main/README.md)
- [Pro overview (RevealUI)](/docs/PRO)
