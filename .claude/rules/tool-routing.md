# Claude Tool Routing

## Enforced Split (Session 15)

Professional and personal work use **separate Claude Code instances** with separate global configs.

## RevealUI Development (WSL ONLY)

| Tool | Role | Details |
|------|------|---------|
| Claude Code (WSL terminal) | PRIMARY | Full dev access, Nix/direnv, builds, deploys |
| Claude Code (Zed ACP) | EDITING | Direct WSL filesystem via remote_connection |
| Claude Desktop (Windows GUI) | RESEARCH ONLY | For conversation, planning, web research. Not for code editing. |

## Rules

1. All RevealUI work happens from WSL terminal or Zed ACP — no exceptions
2. Windows Claude Code is NOT used for RevealUI (not even read-only browsing)
3. Never commit from the Windows clone (pre-commit hook blocks this)
4. Claude Desktop is for architecture discussions and research, not code

## Personal Projects (Windows ONLY)

For personal projects (`C:\Users\joshu\projects\portfolio`, etc.):
- Claude Code (Windows PowerShell/Git Bash) is the primary tool
- Windows Claude Code does NOT touch RevealUI files
