import type { Rule } from '../../schemas/rule.js';

/**
 * Owner 2026-09-05: never local npm tokens / GAT / npm login for publish.
 * npm changelog 2026-07-08: 2FA-bypass GATs lose direct publish (~Jan 2027);
 * trusted publishing (OIDC) is the remaining automated path.
 */
export const npmOidcPublishRule: Rule = {
  id: 'npm-oidc-publish',
  tier: 'oss',
  name: 'npm OIDC publish only',
  description:
    'Never npm login, never GAT or _authToken, never local npm/pnpm publish; only GitHub Actions OIDC on main',
  scope: 'global',
  preambleTier: 1,
  tags: ['npm', 'oidc', 'hardline', 'publish', 'supply-chain'],
  content: `# npm OIDC publish only

**Status:** HARDLINE. Owner 2026-09-05. npm changelog 2026-07-08 (GAT bypass2FA deprecation).

Automated npm publish is **trusted publishing (OIDC)** via GitHub Actions \`release.yml\` on \`main\`. There is no local publish path for agents.

## Never (any session, any adapter)

- \`npm login\` / \`npm logout\` recipes for publishing
- Granular access tokens (GAT), \`bypass2fa\`, or \`//registry.npmjs.org/:_authToken\`
- \`npm config set\` of an npm token
- Local \`npm publish\` / \`pnpm publish\` / \`pnpm changeset:publish\`
- "Emergency" or "just this once" token publish to unblock a leftover
- Teaching the owner to mint a publish token

## Always

1. Author a changeset with the code. Merge to \`test\`.
2. Owner promotes \`test\` → \`main\` (head must be \`test\`).
3. Owner runs **Actions → Release OSS Packages** (\`release.yml\`, OIDC, environment \`npm-publish\`).
4. Confirm with \`npm view <pkg> version\` and \`exports\` — then continue dependents.

Trusted-publisher setup (npm UI, interactive 2FA — a GAT cannot do this): repo \`RevealUIStudio/revealui\`, workflow \`release.yml\`, environment \`npm-publish\`.

## If a leftover is blocked on a missing npm version

Say so. Do not invent a token workaround. Wait for OIDC publish, then bump dependents off the registry (no path deps).
`,
};
