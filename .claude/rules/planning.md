# Planning Convention

## Single Source of Truth

All planning lives in `docs/MASTER_PLAN.md`. No other plan documents.

## Rules

- NEVER create separate plan files for RevealUI work
- When Claude Code enters plan mode, write session plans to the ephemeral plan file (required by the tool), but all durable planning goes into MASTER_PLAN.md
- Session plan files in `~/.claude/plans/` are ephemeral scratch — delete after session
- If a plan grows beyond MASTER_PLAN.md scope (e.g., personal projects), it belongs in that project's own docs/

## Task Agent Instructions

When spawning sub-agents via the Task tool:
- Include "Current phase: [X]" and relevant MASTER_PLAN.md context in the prompt
- Include workboard state if the sub-agent will touch shared files
- Sub-agents must NOT create or modify plan documents
- Sub-agents report findings back to the parent agent, who updates MASTER_PLAN.md
