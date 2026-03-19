# RevealUI Shell — Strategic Direction Plan

## Implementation Status (2026-03-17)
- **MVP Phase COMPLETE**: Rust git backend + Git panel UI + flake.nix `libgit2` + `similar`/`dissimilar`
- Next: v1 — CodeMirror 6 editor + push/pull + branch management

---

## Context

RevealUI needs a unified developer shell that combines the best patterns from:
- **Codex** — agent session management (task queue, parallel agents, sandboxed environments, file tree + diff review)
- **Zed** — hand editing quality (GPU-accelerated, tree-sitter, LSP, fast)
- **Claude Code** — best-in-class AI agent orchestration
- **Magit** — keyboard-driven git workflow (widely considered the best git UI ever made)

The goal: a single RevealUI shell that is the user's primary development environment. External editors (Zed, VS Code) remain optional supplements, not requirements.

This is a **strategic direction document**, not an implementation plan for today. RevealUI is in Phase 0.

---

## Licensing Reality (eliminates several options)

| Option | License | Ship Proprietary? | Verdict |
|--------|---------|-------------------|---------|
| Fork Zed | GPL-3.0 | NO | **Eliminated** |
| Fork VS Code | MIT | Yes, but marketplace lock-out + rebase hell | **Avoid** |
| Fork Lapce | Apache 2.0 | Yes | Possible but you'd maintain Floem UI framework |
| **GPUI** (Zed's UI framework) | **Apache 2.0** | **Yes** | **Viable** — separate crate, no GPL |
| **CodeMirror 6** | **MIT** | **Yes** | **Viable** — web-based, embeds in Tauri |
| Monaco | MIT | Yes | Viable but looks like VS Code, heavy |
| Tree-sitter | MIT | Yes | Use regardless of editor choice |

**Key discovery**: GPUI (Zed's GPU-accelerated UI framework) is **Apache 2.0**, separately published on crates.io. You can build a commercial product on GPUI without any GPL obligations. This is the path to Zed-quality rendering without forking Zed.

---

## Recommended Direction: Two-Phase Architecture

### Near-term (Phase 0-1): CodeMirror 6 in Tauri Studio

Extend the existing Studio app with a code editing + review + git panel using CodeMirror 6. This proves the concept and ships value fast.

**Why CodeMirror 6 first:**
- MIT licensed, ~200KB (vs Monaco's 4MB)
- `@codemirror/merge` provides side-by-side diffs
- Full LSP support possible via language server clients
- Works cleanly in Tauri's WebView (no worker CSP issues like Monaco)
- Modular — load only what you need
- Doesn't look like VS Code (important for brand identity)
- Used by Replit, Observable, and many production editors

**What this phase builds inside Studio:**
- Code editing panel with syntax highlighting, LSP, keybindings
- Git workflow panel (status, staging, diff, commit, branch, merge, push/pull)
- Agent session management UI (Codex-inspired task queue)
- AI review flow (accept/reject/modify diffs from AI agents)
- File tree with git status indicators
- Integrated terminal (xterm.js already exists in Studio)

**Diff engine (Rust backend):**
- `git2` (MIT/Apache) — libgit2 bindings for all git operations
- `similar` (MIT/Apache) — Myers + Patience diff algorithms
- `dissimilar` (MIT/Apache) — semantic cleanup (Google diff-match-patch port)
- Compute diffs in Rust, render in CodeMirror 6. Frontend never computes diffs.

### Long-term (Phase 2+): GPUI Native Shell

Once the concept is proven and the product has users, evaluate migrating the editor surface from CodeMirror 6 (WebView) to GPUI (native GPU rendering). This would give Zed-level performance for hand editing while keeping the Tauri shell for non-editor panels.

**Why wait:**
- GPUI is powerful but requires building editor logic from scratch
- Phase 0 needs to prove value, not chase performance
- CodeMirror 6 is good enough for MVP and v1
- GPUI migration can be incremental (replace the editor panel, keep everything else)

---

## Architecture

```
RevealUI Studio Shell
├── Shell Chrome (Tauri + React)
│   ├── Sidebar (file tree, git status, agent sessions)
│   ├── Activity Bar (editor, git, agents, terminal, settings)
│   └── Status Bar (branch, sync status, agent count)
│
├── Editor Panel (CodeMirror 6 → GPUI in future)
│   ├── Tab bar (open files)
│   ├── Code editor (syntax highlighting, LSP, keybindings)
│   ├── Diff view (split or unified, per-hunk accept/reject)
│   └── Minimap / breadcrumbs
│
├── Agent Panel (Codex-inspired)
│   ├── Task queue (parallel agent sessions)
│   ├── Per-task: terminal log, file changes, diff preview
│   ├── Accept/reject/modify per-task
│   └── Provenance tracking (who wrote what — human vs AI vs which model)
│
├── Git Panel (Magit-inspired)
│   ├── Status view (staged, unstaged, untracked)
│   ├── Staging (per-file, per-hunk)
│   ├── Commit form (conventional commits)
│   ├── Branch management (create, switch, merge, rebase)
│   ├── Log viewer (interactive, filterable by provenance)
│   └── Push/pull with progress
│
├── Terminal Panel (xterm.js — already exists)
│
└── Rust Backend (Tauri IPC)
    ├── commands/git.rs — git2 bindings
    ├── commands/diff.rs — similar + dissimilar
    ├── commands/lsp.rs — language server management
    ├── commands/agent.rs — agent session lifecycle
    ├── commands/ssh.rs — already exists
    └── platform/ — PlatformOps trait (already exists)
```

### Integration with existing RevealUI packages

| Package | Role in Shell |
|---------|--------------|
| `@revealui/editors` daemon | "Open in external editor" handoff (Zed/VS Code/Neovim) |
| `@revealui/ai` | Agent orchestration, LLM provider abstraction |
| `@revealui/harnesses` | Agent session coordination, JSON-RPC |
| `@revealui/mcp` | Tool execution (Stripe, Vercel, Neon, Supabase, Playwright) |
| `@revealui/contracts` | Code provenance schemas, type-safe IPC types |
| `@revealui/presentation` | UI component primitives (reuse in shell) |
| `@revealui/sync` | Real-time collaborative review (future) |

### Local Model Integration (Forge Drive)

- **FunctionGemma** (270M params, 301MB) — lightweight function-calling model for tool routing
  - Runs on Ollama via Forge drive (`/mnt/forge/models/ollama/`)
  - Use for: routing agent tool calls locally, structured output, function dispatch
  - NOT for code generation (too small) — use Claude/GPT for that
  - Symlinked from `/usr/share/ollama/.ollama/models` → `/mnt/forge/models/ollama/`
- **Larger models** (llama3.2, etc.) on Forge drive for local code generation/review
- Shell's agent panel can route to local (Ollama) or cloud (Claude API) based on task complexity

---

## What NOT To Do

1. **Do NOT fork Zed** — GPL-3.0 forces open-sourcing all modifications
2. **Do NOT fork VS Code** — maintenance hell, Microsoft extension lock-out (2025), looks generic
3. **Do NOT build a full editor from scratch in Phase 0** — prove the concept with CodeMirror 6 first
4. **Do NOT compute diffs in JavaScript** — Rust backend has `similar`/`dissimilar`, use it
5. **Do NOT build a GitHub PR review tool** — focus on pre-commit review (AI output → human approval → commit)
6. **Do NOT use Monaco** — 4MB, CSP issues in Tauri, makes your product look like VS Code

---

## Licensing & Distribution Model

| Component | License | Tier |
|-----------|---------|------|
| Studio shell (Tauri + editor + git panel) | MIT | Free (drives adoption) |
| CodeMirror 6, git2, similar, tree-sitter | MIT/Apache | OSS dependencies |
| AI agent integration + session management | Commercial | Pro |
| Code provenance tracking | Commercial | Pro |
| Semantic/structural diff (tree-sitter AST) | Commercial | Pro |
| Multi-repo coordination | Commercial | Pro |
| Local model integration (Ollama) | Commercial | Pro |
| Collaborative review (Yjs/CRDT) | Commercial | Enterprise |

Free tier is a genuinely useful editor + git client. Pro tier adds AI and provenance. This mirrors the existing RevealUI model.

---

## Key Dependencies (new)

**Rust (Cargo.toml):**
- `git2 = "0.19"` — libgit2 bindings
- `similar = "2"` — diff algorithms
- `dissimilar = "1"` — semantic diff cleanup
- `tree-sitter = "0.24"` — structural parsing (v1+)

**TypeScript (package.json):**
- `@codemirror/state`, `@codemirror/view`, `@codemirror/merge` — editor + diff
- `@codemirror/lang-*` — language packs (JS, TS, Rust, CSS, HTML, JSON, Markdown)
- `@lezer/highlight` — syntax highlighting themes

---

## Phased Roadmap Summary

| Phase | Focus | Key Deliverable |
|-------|-------|----------------|
| **MVP** ✅ DONE | Git panel + diff viewer in Studio | File tree, patch diff view, staging, commit |
| **v1** (6-8 weeks) | Full editing + AI review flow | CodeMirror editor tabs, LSP, agent session panel, provenance |
| **v2** (8-12 weeks) | Multi-repo + conflicts + keyboard workflow | Merge resolution, Magit keybindings, PR creation, history |
| **Future** | GPUI migration | Native GPU rendering for editor panel, Zed-level performance |

---

## Critical Files

- `apps/studio/src-tauri/Cargo.toml` — add git2, similar, dissimilar
- `apps/studio/src-tauri/src/commands/` — new git.rs, diff.rs modules
- `apps/studio/src/types.ts` — extend Page type, IPC interfaces
- `apps/studio/src/components/` — new CodeShell, GitPanel, AgentPanel components
- `packages/contracts/src/entities/code-provenance.ts` — provenance schemas
- `packages/editors/` — existing daemon, "open in external editor" integration

---

## Verification

Once MVP is built:
1. Open Studio, navigate to Code panel
2. See file tree with git status colors for a real repo
3. Click a modified file, see CodeMirror 6 diff (split view)
4. Stage files via checkbox or keyboard shortcut
5. Write commit message, commit
6. Verify commit appears in git log
7. Push to remote, confirm success
