# @revealui/cli

## 0.6.3

### Patch Changes

- 0f195e4: SDLC hardening, content overhaul, and cms→admin rename.

  - Promote all CI quality checks from warn-only to hard-fail
  - Kill banned phrases across 58 files (headless CMS → agentic business runtime)
  - Rename apps/cms to apps/admin throughout the codebase
  - Remove proprietary AI providers (Anthropic, OpenAI direct) — keep OpenAI-compatible base
  - Add Gmail-first email provider to MCP server (Resend deprecated)
  - Fix CodeQL security alerts (XSS validation, path traversal guard, prototype-safe objects)
  - Align all coverage thresholds with actual coverage
  - Add 4 ADRs (dual-database, Fair Source licensing, session-only auth, two-repo model)

- Updated dependencies [0f195e4]
  - @revealui/config@0.3.3
  - @revealui/setup@0.3.4
  - @revealui/ai@0.2.8

## 0.6.2

### Patch Changes

- add offline-first cache layer and sync status indicator, fix infinite type instantiation in cn utility, replace core dep with utils in router, remove Cursor IDE support from editors
- Updated dependencies
- Updated dependencies
  - @revealui/setup@0.3.3
  - @revealui/config@0.3.2
  - @revealui/ai@0.2.7

## 0.6.1

### Patch Changes

- f6a81c7: Fix @revealui/ai peer dependency version range

## 0.6.0

### Minor Changes

- 9361f3c: feat(cli): add terminal profile installer subcommand

  New `revealui terminal install` and `revealui terminal list` commands that auto-detect
  the platform and installed terminal emulators, then install RevealUI terminal profiles.

  Supported terminals:

  - macOS: iTerm2, Terminal.app, Alacritty, Kitty
  - Linux: Alacritty, Kitty, GNOME Terminal

### Patch Changes

- Updated dependencies
  - @revealui/config@0.3.1
  - @revealui/setup@0.3.2
  - @revealui/ai@0.2.6

## 0.5.0

### Minor Changes

- 9361f3c: feat(cli): add terminal profile installer subcommand

  New `revealui terminal install` and `revealui terminal list` commands that auto-detect
  the platform and installed terminal emulators, then install RevealUI terminal profiles.

  Supported terminals:

  - macOS: iTerm2, Terminal.app, Alacritty, Kitty
  - Linux: Alacritty, Kitty, GNOME Terminal

## 0.4.0

### Minor Changes

- Add `revealui agent` command and OSS AI rules pull during project scaffolding

### Patch Changes

- @revealui/ai@0.2.2

## 0.3.4

### Patch Changes

- f89b9ff: Upgrade production dependencies: lexical 0.40→0.42, @vercel/blob 2.2→2.3, drizzle-orm 0.45.1→0.45.2, ora 8→9, commander 13→14, inquirer 12→13
- Updated dependencies [f89b9ff]
  - @revealui/setup@0.3.1

## 0.3.3

### Patch Changes

- Fix templates: remove unpublished @revealui/dev dependency, inline tsconfig, use "latest" for @revealui/\* deps

## 0.3.2

### Patch Changes

- Fix template directory resolution — templates now found correctly after tsup bundling

## 0.3.1

### Patch Changes

- Fix -y/--yes flag not skipping template and project name prompts

## 0.3.0

### Minor Changes

- Initial public release. Business OS Software (BOSS) — users, content, products, payments, and AI, pre-wired, open source, and ready to deploy.

### Patch Changes

- Updated dependencies
  - @revealui/config@0.3.0
  - @revealui/setup@0.3.0

## 0.2.0

### Minor Changes

- 4d76d68: Initial stable release of `create-revealui` CLI scaffolding tool.

  - Project templates for new RevealUI applications
  - Interactive setup wizard
  - Configurable project structure

### Patch Changes

- Updated dependencies [4d76d68]
- Updated dependencies [4d76d68]
  - @revealui/config@0.2.0
  - @revealui/setup@0.2.0
