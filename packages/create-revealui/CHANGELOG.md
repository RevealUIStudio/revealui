# create-revealui

## 0.5.4

### Patch Changes

- OpenAPI Phase B with native Zod-to-OpenAPI scaffold. Pipeline gap fixes, pre-push tests, code-pattern scanner. Dependency updates and SDLC hardening.
- Updated dependencies
  - @revealui/cli@0.6.4

## 0.5.3

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
  - @revealui/cli@0.6.3

## 0.5.2

### Patch Changes

- Updated dependencies
  - @revealui/cli@0.6.2

## 0.5.1

### Patch Changes

- Updated dependencies [f6a81c7]
  - @revealui/cli@0.6.1

## 0.5.0

### Minor Changes

- 9361f3c: feat(cli): add terminal profile installer subcommand

  New `revealui terminal install` and `revealui terminal list` commands that auto-detect
  the platform and installed terminal emulators, then install RevealUI terminal profiles.

  Supported terminals:

  - macOS: iTerm2, Terminal.app, Alacritty, Kitty
  - Linux: Alacritty, Kitty, GNOME Terminal

### Patch Changes

- Updated dependencies [9361f3c]
  - @revealui/cli@0.6.0

## 0.4.0

### Minor Changes

- 9361f3c: feat(cli): add terminal profile installer subcommand

  New `revealui terminal install` and `revealui terminal list` commands that auto-detect
  the platform and installed terminal emulators, then install RevealUI terminal profiles.

  Supported terminals:

  - macOS: iTerm2, Terminal.app, Alacritty, Kitty
  - Linux: Alacritty, Kitty, GNOME Terminal

### Patch Changes

- Updated dependencies [9361f3c]
  - @revealui/cli@0.5.0

## 0.3.5

### Patch Changes

- Updated dependencies
  - @revealui/cli@0.4.0

## 0.3.4

### Patch Changes

- Updated dependencies [f89b9ff]
  - @revealui/cli@0.3.4

## 0.3.3

### Patch Changes

- Fix templates: remove unpublished @revealui/dev dependency, inline tsconfig, use "latest" for @revealui/\* deps
- Updated dependencies
  - @revealui/cli@0.3.3

## 0.3.2

### Patch Changes

- Fix template directory resolution — templates now found correctly after tsup bundling
- Updated dependencies
  - @revealui/cli@0.3.2

## 0.3.1

### Patch Changes

- Fix -y/--yes flag not skipping template and project name prompts
- Updated dependencies
  - @revealui/cli@0.3.1

## 0.3.0

### Minor Changes

- Initial public release. Business OS Software (BOSS) — users, content, products, payments, and AI, pre-wired, open source, and ready to deploy.

### Patch Changes

- Updated dependencies
  - @revealui/cli@0.3.0
