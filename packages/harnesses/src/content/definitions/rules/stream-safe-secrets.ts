import type { Rule } from '../../schemas/rule.js';

/**
 * Stream-safe revvault use: paths on argv, values only in child env (GAP-468).
 * Owner ADR 2026-08-05-stream-safe-secrets (.jv).
 */
export const streamSafeSecretsRule: Rule = {
  id: 'stream-safe-secrets',
  tier: 'oss',
  name: 'Stream-Safe Secrets',
  description:
    'Never put secret values on argv or stream-captured TTY; use revvault run / with-secrets; vault-private only for full print',
  scope: 'global',
  preambleTier: 1,
  tags: ['secrets', 'hardline', 'revvault', 'stream', 'obs'],
  content: `# Stream-Safe Secrets

**Status:** HARDLINE. ADR \`2026-08-05-stream-safe-secrets\` (.jv). GAP-468.

Every secret lives in revvault. How values reach a process is constrained so
YouTube/OBS, agent transcripts, and \`pnpm\` argv echoes never show them.

## Rules

1. **Path on the command line, value only in the child environment.**
   \`\`\`bash
   revvault run --env KEY=vault/path -- <cmd>
   with-secrets stripe neon -- <cmd>
   \`\`\`
2. **Never** expand \`$(revvault get …)\` into CLI flags or export lines that
   other tools will print. PreToolUse denies that shape for agents.
3. **Never** pass credential-bearing URLs as flags
   (e.g. \`--database-url 'postgresql://user:pass@…'\`). Prefer
   \`NEON_DATABASE_URL\` / \`POSTGRES_URL\` via \`revvault run\` / namespaces.
4. **Stream mode** (\`STREAM_SAFE=1\` / \`stream-safe\`): \`revvault get\` refuses
   TTY print and \`--clip\` unless \`REVVAULT_ALLOW_PRINT=1\`. Piped script use
   (non-TTY stdout) still works.
5. **Vault-private mode** (\`vault-private\` / \`REVVAULT_ALLOW_PRINT=1\`): only
   place for full \`get --full\` / \`--clip\`. Keep the window out of OBS capture.
6. **Fail loud** with the revvault **path** when a secret is missing — never a
   silent default and never echo the value.

## Dual terminal modes

| Mode | Prompt cue | Allowed |
|------|------------|---------|
| Stream | \`stream\` | Paths + run / with-secrets |
| Vault-private | \`VAULT\` | Full get / clip (break-glass) |

## Namespaces

\`revealui/env/<ns>\` bundles (e.g. \`stripe\`, \`neon\`) feed \`with-secrets\` and
\`revvault run --namespace\`. Prefer namespaces for stream paste recipes.

## What this rules out

- Teaching-only "don't paste secrets" without \`revvault run\` / hook deny
- Dual secret stores for stream vs private (one vault, two **output** modes)
- Logging or printing secret values in CI, agents, or docs

## References

- Plane A adapter: \`~/.claude/rules/secrets.md\`
- CLI: \`revvault run\`, stream-safe get gate
- Shell: revkit \`stream-safe\`, \`vault-private\`, \`with-secrets\`
`,
};
