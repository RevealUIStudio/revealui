---
"@revealui/cli": minor
"create-revealui": minor
---

feat(cli): add terminal profile installer subcommand

New `revealui terminal install` and `revealui terminal list` commands that auto-detect
the platform and installed terminal emulators, then install RevealUI terminal profiles.

Supported terminals:
- macOS: iTerm2, Terminal.app, Alacritty, Kitty
- Linux: Alacritty, Kitty, GNOME Terminal
