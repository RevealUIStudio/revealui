# revealui

Meta-installer for [RevealUI](https://revealui.com) — the open-source agentic business runtime.

This package is a thin alias around [`create-revealui`](https://www.npmjs.com/package/create-revealui). Running `revealui` invokes the same scaffolder under the hood.

## Use

Three equivalent ways to scaffold a new RevealUI project:

```bash
# One-shot, no install
npx revealui my-business

# Install once, run anywhere
npm install -g revealui
revealui my-business

# npm-create convention (uses create-revealui directly)
npm create revealui my-business
```

All three produce the same scaffold.

## Why this package exists

`create-revealui` is the canonical scaffolder. This `revealui` package exists so that `npm install revealui` and `npx revealui` also work — letting the install command match the brand name people actually search for, and reserving the unscoped name in the public npm registry.

## Documentation

- Project site: <https://revealui.com>
- Documentation: <https://docs.revealui.com>
- Source: <https://github.com/RevealUIStudio/revealui>
- Issues: <https://github.com/RevealUIStudio/revealui/issues>

## License

MIT — see [LICENSE](LICENSE).
