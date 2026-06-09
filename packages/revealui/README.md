---
title: "revealui"
description: "Meta-installer for [RevealUI](https://revealui.com) — the open-source agentic business runtime."
visibility: public
status: verified
audience: user
---

# revealui

Meta-installer for [RevealUI](https://revealui.com) — the open-source agentic business runtime.

This package is a thin alias around [`create-revealui`](https://www.npmjs.com/package/create-revealui). Running the local `revealui` bin invokes the same scaffolder under the hood.

> **Not published to npm.** npm rejects the bare name `revealui` as too similar to `reveal-ui`. Use `create-revealui` directly instead.

## Use

The canonical way to scaffold a new RevealUI project:

```bash
# npm-create convention (uses create-revealui directly)
npm create revealui my-business

# or with pnpm
pnpm create revealui my-business
```

## Why this package exists

`create-revealui` is the canonical scaffolder. This `revealui` package is a local monorepo alias wired to the same `bin/revealui.js` entry, kept in case the npm name registration succeeds in future. Currently `"private": true` — not published.

## Documentation

- Project site: <https://revealui.com>
- Documentation: <https://docs.revealui.com>
- Source: <https://github.com/RevealUIStudio/revealui>
- Issues: <https://github.com/RevealUIStudio/revealui/issues>

## License

MIT — see [LICENSE](LICENSE).
