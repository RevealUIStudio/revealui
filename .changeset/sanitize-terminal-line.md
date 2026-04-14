---
'@revealui/security': minor
---

Add `sanitizeTerminalLine` for stripping ANSI escape sequences from untrusted terminal output. Preserves SGR color codes; removes CSI/OSC/DCS sequences and C0/C1 control chars. Used by RevDev Studio's terminal view.
