---
"@revealui/core": patch
"@revealui/db": patch
"@revealui/auth": patch
"@revealui/contracts": patch
"@revealui/presentation": patch
"@revealui/cli": patch
"@revealui/mcp": patch
"@revealui/security": patch
"@revealui/utils": patch
"@revealui/config": patch
"@revealui/router": patch
"@revealui/setup": patch
"@revealui/sync": patch
"@revealui/cache": patch
"@revealui/resilience": patch
"@revealui/openapi": patch
"@revealui/editors": patch
"@revealui/paywall": patch
"@revealui/animations": patch
"@revealui/services": patch
"@revealui/ai": patch
"@revealui/harnesses": patch
"create-revealui": patch
---

SDLC hardening, content overhaul, and cms→admin rename.

- Promote all CI quality checks from warn-only to hard-fail
- Kill banned phrases across 58 files (headless CMS → agentic business runtime)
- Rename apps/cms to apps/admin throughout the codebase
- Remove proprietary AI providers (Anthropic, OpenAI direct) — keep OpenAI-compatible base
- Add Gmail-first email provider to MCP server (Resend deprecated)
- Fix CodeQL security alerts (XSS validation, path traversal guard, prototype-safe objects)
- Align all coverage thresholds with actual coverage
- Add 4 ADRs (dual-database, Fair Source licensing, session-only auth, two-repo model)
