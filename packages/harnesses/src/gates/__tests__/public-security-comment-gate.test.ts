import { describe, expect, it } from 'vitest';
import {
  checkPublicSecurityComment,
  extractCommentBody,
  isGithubCommentCommand,
  PUBLIC_VERDICT_MAX_CHARS,
  renderPublicGuardrail2Comment,
} from '../public-security-comment-gate.js';

const SHORT_APPROVE = `## Guardrail-2 security verdict: APPROVE

Session identity is resolved before entitlements. No new authorization bypass found.

Residual review notes are private, not in this comment.

<!-- guardrail2-verdict: APPROVE -->
`;

const ESSAY = `## Guardrail-2 security verdict: APPROVE

### Attack checklist

1. **AuthN/AuthZ** — optionalAuth now runs first.
2. **Tenant/scope isolation** — omit agentId to get the full catalog.

### Findings
**F1** privilege escalation via fail-open include.
**Finding F1** — concrete bypass: crafted client omits agentId.

<!-- guardrail2-verdict: APPROVE -->
`;

function commentCmd(repo: string, body: string): string {
  return `gh pr comment 2640 -R ${repo} --body ${JSON.stringify(body)}`;
}

describe('isGithubCommentCommand', () => {
  it('detects gh pr comment and review', () => {
    expect(isGithubCommentCommand('gh pr comment 1 -R o/r --body hi')).toBe(true);
    expect(isGithubCommentCommand('gh pr review 1 --comment -b x')).toBe(true);
    expect(isGithubCommentCommand('gh issue comment 9 --body x')).toBe(true);
  });

  it('detects gh api comment routes', () => {
    expect(
      isGithubCommentCommand(
        'gh api -X PATCH repos/RevealUIStudio/revealui/issues/comments/1 -f body=hi',
      ),
    ).toBe(true);
  });

  it('ignores view/list', () => {
    expect(isGithubCommentCommand('gh pr view 1 --json comments')).toBe(false);
    expect(isGithubCommentCommand('pnpm test')).toBe(false);
  });
});

describe('extractCommentBody', () => {
  it('reads --body and heredoc', () => {
    expect(extractCommentBody('gh pr comment 1 --body "hello there"')).toBe('hello there');
    expect(
      extractCommentBody('gh pr comment 1 --body "line one\\nAttack checklist\\nline two"'),
    ).toContain('Attack checklist');
    const heredoc = `gh pr comment 1 -R o/r --body "$(cat <<'EOF'\nline one\nline two\nEOF\n)"`;
    expect(extractCommentBody(heredoc)).toContain('line one');
    expect(extractCommentBody(heredoc)).toContain('line two');
  });
});

describe('checkPublicSecurityComment', () => {
  it('allows a short public verdict', () => {
    expect(checkPublicSecurityComment(commentCmd('RevealUIStudio/revealui', SHORT_APPROVE)).block).toBe(
      false,
    );
  });

  it('blocks the 2640-shaped public attack writeup', () => {
    const r = checkPublicSecurityComment(commentCmd('RevealUIStudio/revealui', ESSAY));
    expect(r.block).toBe(true);
    expect(r.rule).toBe('public-security-comment');
  });

  it('blocks a long public verdict even without extra markers', () => {
    const long = `<!-- guardrail2-verdict: APPROVE -->\n${'x'.repeat(PUBLIC_VERDICT_MAX_CHARS)}`;
    expect(checkPublicSecurityComment(commentCmd('RevealUIStudio/revealui', long)).block).toBe(true);
  });

  it('allows the same essay on the private planning repo', () => {
    expect(checkPublicSecurityComment(commentCmd('RevealUIStudio/revealui-jv', ESSAY)).block).toBe(
      false,
    );
  });

  it('fail-closes when the repo is omitted and the body is an essay', () => {
    expect(checkPublicSecurityComment(`gh pr comment 1 --body ${JSON.stringify(ESSAY)}`).block).toBe(
      true,
    );
  });

  it('allows non-comment gh and short product comments', () => {
    expect(checkPublicSecurityComment('gh pr view 2640 -R RevealUIStudio/revealui').block).toBe(
      false,
    );
    expect(
      checkPublicSecurityComment(
        commentCmd('RevealUIStudio/revealui', 'Thanks. The CSRF follow-up is in the private notes.'),
      ).block,
    ).toBe(false);
  });
});

describe('renderPublicGuardrail2Comment', () => {
  it('renders a short marker comment', () => {
    const body = renderPublicGuardrail2Comment(
      'APPROVE',
      'Auth now runs before entitlements. No new bypass found.',
    );
    expect(body).toContain('<!-- guardrail2-verdict: APPROVE -->');
    expect(body.length).toBeLessThan(PUBLIC_VERDICT_MAX_CHARS);
    expect(checkPublicSecurityComment(commentCmd('RevealUIStudio/revealui', body)).block).toBe(
      false,
    );
  });

  it('refuses an essay-shaped summary', () => {
    expect(() => renderPublicGuardrail2Comment('APPROVE', 'Attack checklist goes here')).toThrow();
  });
});
