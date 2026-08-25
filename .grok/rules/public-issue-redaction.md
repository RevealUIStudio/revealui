# Public Issue Redaction (HARDLINE)

Public issues, PRs, and comments are indexed. Treat them as attacker-readable.

## Guardrail-2 on a public PR

**Allowed on the public PR:** the verdict word, a short (few-sentence) summary
that does not teach an exploit, and the machine marker:

`<!-- guardrail2-verdict: APPROVE -->`
or
`<!-- guardrail2-verdict: REQUEST-CHANGES -->`

**Never on a public PR/issue/comment:**

- Attack checklists, bypass attempts, repros, or "Finding F*" writeups
- Maps of residual / fail-open / not-yet-wired enforcement
- Live counts of unfixed security findings with paths

Those notes go to the private planning repo (or another private review surface).
The public marker is what the merge gate parses. The essay is not.

Enforcement: `@revealui/harnesses/gates` `checkPublicSecurityComment` runs in
every PreToolUse path (Grok, Claude, Cursor, VS Code). It blocks `gh pr comment`,
`gh pr review`, and `gh api …/comments` to public repos when the body is an
essay. A short marker comment is allowed.

Do not wrap that hook in `|| true`. A deny that cannot land is not a gate.

## Other public-issue classes (unchanged)

Do not publish client/prospect names, founder home paths, live secrets, or
internal hostnames on public GitHub. See the private planning rule for the
full redaction list.

## References

- Control-layer gate: `packages/harnesses/src/gates/public-security-comment-gate.ts`
- Sibling: disposition-actions (verdict comments stay proposal-shaped; they
  must still be public-safe)
