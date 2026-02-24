# Claude Tool Routing

## RevealUI Development

| Tool | Role | Details |
|------|------|---------|
| Claude Code (WSL terminal) | PRIMARY | Full dev access, Nix/direnv, builds, deploys |
| Claude Code (Zed ACP) | EDITING | Direct WSL filesystem via remote_connection |
| Claude Code (Windows terminal) | READ-ONLY | Can browse Windows clone, shell out via wsl.exe for commands |
| Claude Desktop (Windows GUI) | RESEARCH ONLY | For conversation, planning, web research. Not for code editing. |

## Rules

1. All RevealUI file edits must happen via WSL terminal or Zed ACP
2. Never commit from the Windows clone (pre-commit hook blocks this)
3. Windows Claude Code can read files for context but must run edits via `wsl.exe`
4. Claude Desktop is for architecture discussions and research, not code
5. When a Windows Claude Code session needs to modify RevealUI files, it should
   use `wsl.exe -d Ubuntu -- bash -ilc "cd ~/projects/RevealUI && <command>"`

## Personal Projects (Windows)

For personal projects (`C:\Users\joshu\projects\portfolio`, etc.):
- Claude Code (Windows terminal) is the primary tool
- Claude Desktop can edit files normally (no WSL issues)
