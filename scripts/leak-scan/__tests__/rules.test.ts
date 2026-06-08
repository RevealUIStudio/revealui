import { describe, expect, it } from 'vitest';
import { BASE_RULES, type Rule, SENSITIVE_TAGS } from '../rules';

const byTag = (tag: string): Rule => {
  const r = BASE_RULES.find((x) => x.tag === tag);
  if (!r) throw new Error(`no BASE rule with tag ${tag}`);
  return r;
};

// One positive + one negative per BASE rule, mirroring the legacy ERE semantics.
const cases: ReadonlyArray<{ tag: string; hit: string; miss: string }> = [
  { tag: 'abs-home-path', hit: 'see /home/alice/x', miss: 'see /home//x' },
  { tag: 'abs-windows-user', hit: 'C:\\Users\\alice\\x', miss: 'C:\\Programs\\x' },
  { tag: 'private-jv-repo', hit: '~/revfleet/.jv/docs', miss: '~/revfleet/revealui' },
  { tag: 'private-jv-name', hit: 'RevealUIStudio/revealui-jv', miss: 'RevealUIStudio/revealui' },
  { tag: 'lts-drive', hit: 'cd /mnt/e/backups', miss: 'cd /mnt/d/backups' },
  { tag: 'forge-drive', hit: '/mnt/forge/x', miss: '/mnt/sand/x' },
  { tag: 'sandbox-drive', hit: '/mnt/sandbox/x', miss: '/mnt/box/x' },
  { tag: 'license-key', hit: 'RVUI-pro-0123456789abcdef00', miss: 'RVUI-pro-0123' },
  { tag: 'vercel-org-id', hit: 'team_ABCDEFGHIJKLMNOP12', miss: 'team_short' },
  { tag: 'vercel-project-id', hit: 'prj_ABCDEFGHIJKLMNOP12', miss: 'prj_tiny' },
  { tag: 'stripe-account', hit: 'acct_ABCDEFGHIJKLMN', miss: 'acct_short' },
  { tag: 'stripe-product', hit: 'prod_ABCDEFGHIJKLMN', miss: 'prod_x' },
  { tag: 'stripe-portal-config', hit: 'bpc_ABCDEFGHIJKLMN', miss: 'bpc_x' },
  { tag: 'revvault-path-prod', hit: 'revvault/prod/stripe', miss: 'revvault/staging/x' },
  { tag: 'revvault-path-dev', hit: 'revvault/dev/x', miss: 'revvault/d/x' },
  { tag: 'revvault-path-forge', hit: 'revvault/forge/x', miss: 'revvault/f/x' },
  { tag: 'age-identity', hit: '~/.age-identity/keys.txt', miss: '~/.ssh/id' },
  { tag: 'coord-paths', hit: '.claude/coordination/branches.json', miss: '.claude/rules/x' },
  { tag: 'coord-workboard', hit: 'x/.claude/workboard.md', miss: '.claude/workboard' },
  { tag: 'coord-beacon', hit: 'context-beacon.json', miss: 'beacon.json' },
  { tag: 'internal-handoff', hit: 'docs/HANDOFF-2026-06-08-x', miss: 'docs/HANDOFF-x' },
  { tag: 'internal-gap-id', hit: 'GAP-194 blah', miss: 'GAP-7' },
  { tag: 'internal-master-plan', hit: 'docs/MASTER_PLAN.md', miss: 'docs/PLAN.md' },
];

describe('BASE_RULES parity', () => {
  for (const c of cases) {
    it(`${c.tag} hits its positive sample`, () => {
      expect(byTag(c.tag).matches(c.hit)).toBe(true);
    });
    it(`${c.tag} rejects its negative sample`, () => {
      expect(byTag(c.tag).matches(c.miss)).toBe(false);
    });
  }
});

describe('BASE_RULES coverage + trust boundary', () => {
  it('covers every BASE rule with a parity case', () => {
    const tagged = new Set(cases.map((c) => c.tag));
    const uncovered = BASE_RULES.filter((r) => !tagged.has(r.tag)).map((r) => r.tag);
    expect(uncovered).toEqual([]);
  });

  it('ships no sensitive-literal rule in the public bundle', () => {
    const baseTags = new Set(BASE_RULES.map((r) => r.tag));
    const leaked = SENSITIVE_TAGS.filter((t) => baseTags.has(t));
    expect(leaked).toEqual([]);
  });

  it('uses unique tags', () => {
    const tags = BASE_RULES.map((r) => r.tag);
    expect(new Set(tags).size).toBe(tags.length);
  });
});
