# Zed Editor Configuration

This directory contains project-specific configuration for the [Zed editor](https://zed.dev/).

## Files Overview

### `settings.json`
Main configuration file for Zed editor. Contains settings for:
- **Editor behavior**: Tab size, line length, formatting
- **Language servers**: TypeScript/JavaScript LSP configuration
- **Formatting**: Biome integration for consistent code style
- **Inlay hints**: Type information display
- **File associations**: Custom mappings for project files
- **Git integration**: Auto-fetch and blame settings
- **Project search**: Excluded directories (node_modules, .next, etc.)

### `tasks.json`
Pre-configured tasks for common development workflows:
- **Development**: Start dev servers for CMS, API, or all apps
- **Build**: Run production builds
- **Testing**: Run unit, integration, and E2E tests
- **Linting**: Check and fix code quality issues
- **Database**: Init, migrate, seed, and reset operations
- **Dependencies**: Check and fix dependency mismatches
- **Cleanup**: Remove build artifacts and node_modules

## Key Features Configured

### TypeScript/JavaScript Support
- Uses `vtsls` language server (modern TypeScript LSP)
- Auto-imports enabled
- Relative import paths preferred
- Comprehensive inlay hints for types, parameters, and return values
- 8GB memory limit for large monorepo support

### Biome Integration
All formatting and linting is handled by Biome to match your existing setup:
- 2-space indentation
- 100 character line width
- Single quotes for JS/TS
- Auto-organize imports on save
- Auto-fix lint issues on save

### Monorepo Support
- Excluded directories configured for faster search
- pnpm workspace aware
- Turbo cache directories ignored

## Using Tasks

In Zed, you can:
1. Open the command palette (`Cmd+Shift+P` or `Ctrl+Shift+P`)
2. Type "Tasks: Spawn"
3. Select from the list of configured tasks

Or use the keyboard shortcut:
- macOS: `Cmd+Shift+B`
- Linux/Windows: `Ctrl+Shift+B`

## Customization

To customize these settings:
1. Open the command palette
2. Run "zed: open project settings"
3. Or edit `.zed/settings.json` directly

Global user settings are located at:
- macOS: `~/.config/zed/settings.json`
- Linux: `~/.config/zed/settings.json`
- Windows: `%APPDATA%\Zed\settings.json`

## Documentation

- [Zed Documentation](https://zed.dev/docs)
- [All Settings](https://zed.dev/docs/configuring-zed)
- [TypeScript Support](https://zed.dev/docs/languages/typescript)
- [Tasks](https://zed.dev/docs/tasks)
- [Configuring Languages](https://zed.dev/docs/configuring-languages)

## Theme Recommendations

The configuration uses system theme detection with "One Light" and "One Dark" themes. You can change these in settings.json by modifying the `theme` section.

Popular themes for TypeScript development:
- One Dark (default dark)
- One Light (default light)
- Ayu Mirage
- Dracula
- Nord
- Tokyo Night

## Font Recommendations

The configuration uses "Fira Code" with ligatures enabled. If you don't have Fira Code installed, Zed will fall back to the system default.

Other great coding fonts:
- JetBrains Mono
- Cascadia Code
- Hack
- Source Code Pro
- Monaco

## Notes

- Settings are automatically applied when you open this project in Zed
- Some settings may require Zed restart to take effect
- Tasks run in the terminal using your project's pnpm configuration
- The configuration excludes build artifacts and dependencies from search for better performance
