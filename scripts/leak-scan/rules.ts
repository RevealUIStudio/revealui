import {
  type CharClass,
  containsPattern,
  isAlnum,
  isDigit,
  isHexLower,
  isLower,
  isLowerNameChar,
  isNameChar,
  isPathSep,
  lit,
  literalIncludes,
  run,
  type Segment,
} from './predicates';

export interface Rule {
  /** Stable tag, kept 1:1 with the legacy bash scanner so `.leakignore` entries keep resolving. */
  readonly tag: string;
  /** Human-readable reason shown on a hit. */
  readonly reason: string;
  /** True if `line` contains the disallowed pattern. No regex. */
  readonly matches: (line: string) => boolean;
}

const literalRule = (tag: string, value: string, reason: string): Rule => ({
  tag,
  reason,
  matches: (line) => literalIncludes(line, value),
});

const patternRule = (tag: string, segments: readonly Segment[], reason: string): Rule => ({
  tag,
  reason,
  matches: (line) => containsPattern(line, segments),
});

/** 'c' or 'C' — the drive-letter head of the abs-windows-user rule. */
const isCDrive: CharClass = (c) => c === 'c' || c === 'C';

/**
 * BASE ruleset — generic, structural patterns only, kept tag-for-tag with the
 * legacy bash scanner so existing `.leakignore` allowlists keep resolving.
 *
 * Public-safe by construction: every entry describes a SHAPE or a well-known
 * non-secret NAME (mount path, ID format, internal doc name), never a secret
 * VALUE. Sensitive literals (internal hostname, customer / prospect / person
 * names, operator bank, partnership, personal email) are NOT here — see
 * SENSITIVE_TAGS. They are supplied per-repo via local config so this shipped
 * bundle never carries a private value into a public repo.
 */
export const BASE_RULES: readonly Rule[] = [
  patternRule(
    'abs-home-path',
    [lit('/home/'), run(isLower, 1, 1), run(isLowerNameChar, 1)],
    'absolute user home path (/home/<username>/...)',
  ),
  patternRule(
    'abs-windows-user',
    [
      run(isCDrive, 1, 1),
      lit(':'),
      run(isPathSep, 1, 1),
      lit('Users'),
      run(isPathSep, 1, 1),
      run(isNameChar, 1),
    ],
    'absolute Windows user path (C:\\Users\\<name>)',
  ),
  literalRule('private-jv-repo', 'revfleet/.jv', 'private repo path (~/revfleet/.jv/...)'),
  literalRule('private-jv-name', 'revealui-jv', 'private repo name (revealui-jv)'),
  literalRule('lts-drive', '/mnt/e/', 'LTS drive mount path'),
  literalRule('forge-drive', '/mnt/forge/', 'Forge drive mount path'),
  literalRule('sandbox-drive', '/mnt/sandbox/', 'Sandbox drive mount path'),
  patternRule(
    'license-key',
    [lit('RVUI-'), run(isLower, 1), lit('-'), run(isHexLower, 16)],
    'RevealUI license key (looks like a real issued key)',
  ),
  patternRule('vercel-org-id', [lit('team_'), run(isAlnum, 16)], 'Vercel org/team identifier'),
  patternRule('vercel-project-id', [lit('prj_'), run(isAlnum, 16)], 'Vercel project identifier'),
  patternRule('stripe-account', [lit('acct_'), run(isAlnum, 14)], 'Stripe account identifier'),
  patternRule('stripe-product', [lit('prod_'), run(isAlnum, 14)], 'Stripe product identifier'),
  patternRule(
    'stripe-portal-config',
    [lit('bpc_'), run(isAlnum, 14)],
    'Stripe billing portal config identifier',
  ),
  literalRule('revvault-path-prod', 'revvault/prod/', 'revvault prod credential path'),
  literalRule('revvault-path-dev', 'revvault/dev/', 'revvault dev credential path'),
  literalRule('revvault-path-forge', 'revvault/forge/', 'revvault forge credential path'),
  literalRule('age-identity', '.age-identity', 'age identity key reference'),
  literalRule('coord-paths', '.claude/coordination/', 'coordination directory path'),
  literalRule('coord-workboard', '/.claude/workboard.md', 'workboard.md path reference'),
  literalRule('coord-beacon', 'context-beacon.json', 'context-beacon.json path reference'),
  patternRule(
    'internal-handoff',
    [
      lit('/HANDOFF-'),
      run(isDigit, 4, 4),
      lit('-'),
      run(isDigit, 2, 2),
      lit('-'),
      run(isDigit, 2, 2),
    ],
    'internal handoff doc reference',
  ),
  patternRule(
    'internal-gap-id',
    [lit('GAP-'), run(isDigit, 3)],
    'internal gap/work-item identifier (private surface)',
  ),
  literalRule('internal-master-plan', 'MASTER_PLAN.md', 'master plan doc reference'),
];

/**
 * Generic CATEGORY tags for SENSITIVE literal rules. Intentionally absent from
 * BASE_RULES; each repo supplies the actual values via local config. The tags
 * are kept generic (no real customer / prospect / host values) because this
 * source is public — the per-repo cutover maps each bash scanner's specific tag
 * onto the matching category here and into that repo's .leakrules.json (and
 * updates its .leakignore keys to match). A test asserts none appear in BASE.
 */
export const SENSITIVE_TAGS: readonly string[] = [
  'internal-hostname',
  'personal-email',
  'customer-name',
  'customer-brand',
  'prospect-name',
  'prospect-contact',
  'prospect-email',
  'internal-venture',
  'operator-bank',
  'partner-reference',
];
