# RevealUI manager (Codex adapter)

Codex has equal authority with the other project adapters.

1. Read .revealui/manager.json for the project manager and tracker.path.
2. Before acting, read each required shared policy file listed below.
3. Discover generated skills under .agents/skills/. Edit canonical package definitions, then run revealui-harnesses manager materialize to refresh delivery files.
4. Use revealui-harnesses session adapter codex to inspect the session adapter.
5. Follow the same project authorization and security rules as every other adapter.

## Required shared policy

- .revealui/content/rules/adapter-only.md
- .revealui/content/rules/ai-mechanics.md
- .revealui/content/rules/code-over-docs.md
- .revealui/content/rules/disposition-actions.md
- .revealui/content/rules/durable-solutions.md
- .revealui/content/rules/monorepo.md
- .revealui/content/rules/npm-oidc-publish.md
- .revealui/content/rules/public-issue-redaction.md
- .revealui/content/rules/quality-over-speed.md
- .revealui/content/rules/stream-safe-secrets.md
- .revealui/content/rules/token-economy.md
- .revealui/content/rules/tracker-first.md
- .revealui/content/rules/unused-declarations.md

## Additional shared policy

Read applicable rules before work in their scope:

- .revealui/content/rules/agent-dispatch.md: When to spawn specialized agent profiles from .claude/agents/
- .revealui/content/rules/biome.md: Biome 2 linter/formatter rules and suppression protocol
- .revealui/content/rules/code-analysis-policy.md: Prefer AST-based analysis over regex for security and architecture checks
- .revealui/content/rules/database.md: NeonDB (PostgreSQL) primary store, Drizzle ORM, and migration discipline
- .revealui/content/rules/parameterization.md: Never hardcode config values  -  extract, type, default, and make overridable
- .revealui/content/rules/skills-usage.md: When to proactively invoke skills vs wait for explicit user request
- .revealui/content/rules/tailwind.md: Tailwind v4 syntax rules, v3→v4 migration gotchas, and shared config patterns
- .revealui/content/rules/versioning.md: 0.x until real external consumers + stable contract; ai@1.x is a named exception; private packages never 1.0-publish

Shared skills and supporting resources are generated under .revealui/content/skills/ and delivered to the native .agents/skills/ surface.
Native discovery paths are fixed by Codex; manager contentRoot configures the shared source location.

The native entry point is AGENTS.md (or a non-empty AGENTS.override.md).
This adapter supplies project instructions and skills. CodexAdapter also provides
bounded app-server dispatch, streamed output, project-scoped resume, MCP attachment,
and cancellation through the shared harness registry. Approval review uses an optional
host callback; absent review declines. Shared-memory authorization, lifecycle hooks,
and a packaged review UI remain separate runtime milestones. Keep credentials in the existing secret store.

Instruction discovery: https://learn.chatgpt.com/docs/agent-configuration/agents-md
