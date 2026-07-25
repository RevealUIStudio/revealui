import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  AGENT_COMMERCE_BLOCKLIST,
  CLI_TEMPLATE_CLAIM_PATTERNS,
  countCliTemplates,
  countDirs,
  countEnforcementTests,
  countTestFiles,
  countTrackedFiles,
  extractRevealuiPackages,
  findIncompleteProList,
  findLicenseSplitAntiPattern,
  isRoadmapDeclaredFile,
  makeIgnoredPathPredicate,
  parseGitIgnoredOutput,
  TEST_FILE_SUFFIXES,
  WALK_EXCLUDED_DIRS,
} from '../claim-drift.ts';

describe('countDirs', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claim-drift-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('counts only directories that contain package.json', () => {
    fs.mkdirSync(path.join(tmp, 'real-pkg'));
    fs.writeFileSync(path.join(tmp, 'real-pkg', 'package.json'), '{}');

    fs.mkdirSync(path.join(tmp, 'no-pkg'));

    expect(countDirs(tmp)).toBe(1);
  });

  it('returns 0 for a non-existent base directory', () => {
    expect(countDirs(path.join(tmp, 'does-not-exist'))).toBe(0);
  });

  it('returns 0 when base contains only files', () => {
    fs.writeFileSync(path.join(tmp, 'file.txt'), '');
    expect(countDirs(tmp)).toBe(0);
  });
});

describe('countEnforcementTests', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claim-drift-enf-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('counts it()/test() cases across a directory of suites and a single file', () => {
    const dir = path.join(tmp, 'auth');
    fs.mkdirSync(dir);
    // Only *.test.ts files in a directory count; a stray .ts is ignored.
    fs.writeFileSync(
      path.join(dir, 'access.test.ts'),
      "describe('x', () => {\n  it('a', () => {});\n  test('b', () => {});\n});\n",
    );
    fs.writeFileSync(path.join(dir, 'helpers.ts'), "export const it = 'not a test';\n");
    const file = path.join(tmp, 'access-enforcement.test.ts');
    fs.writeFileSync(file, "it('one', () => {});\n  it('two', () => {});\n");
    expect(countEnforcementTests([dir, file])).toBe(4);
  });

  it('does not count it.skip()/it.each() as plain cases', () => {
    const file = path.join(tmp, 'x.test.ts');
    fs.writeFileSync(
      file,
      "it('a', () => {});\nit.skip('b', () => {});\nit.each([1])('c', () => {});\n",
    );
    expect(countEnforcementTests([file])).toBe(1);
  });

  it('returns 0 for missing roots', () => {
    expect(countEnforcementTests([path.join(tmp, 'nope')])).toBe(0);
  });
});

describe('extractRevealuiPackages', () => {
  it('extracts scoped package tokens, stopping at non-package chars', () => {
    expect(
      extractRevealuiPackages('Pro packages (`@revealui/ai`, `@revealui/harnesses`) ship FSL'),
    ).toEqual(['@revealui/ai', '@revealui/harnesses']);
  });

  it('returns an empty array when none are present', () => {
    expect(extractRevealuiPackages('no scoped packages on this line')).toEqual([]);
  });
});

describe('findIncompleteProList', () => {
  const fsl = new Set([
    '@revealui/ai',
    '@revealui/engines',
    '@revealui/harnesses',
    '@revealui/mcp',
    '@revealui/services',
  ]);
  const mit = new Set(['@revealui/core', '@revealui/auth']);

  it('flags a 2-of-5 Pro list', () => {
    expect(
      findIncompleteProList(
        'Pro packages (`@revealui/ai`, `@revealui/harnesses`) are Fair Source',
        fsl,
        mit,
      ),
    ).toEqual(['@revealui/ai', '@revealui/harnesses']);
  });

  it('flags a 3-of-5 Pro list', () => {
    expect(
      findIncompleteProList(
        'Pro packages: @revealui/ai, @revealui/harnesses, @revealui/engines (FSL-1.1-MIT)',
        fsl,
        mit,
      ),
    ).not.toBeNull();
  });

  it('passes the complete 5-package list', () => {
    expect(
      findIncompleteProList(
        'Pro packages: @revealui/ai, @revealui/engines, @revealui/harnesses, @revealui/mcp, @revealui/services',
        fsl,
        mit,
      ),
    ).toBeNull();
  });

  it('ignores a single-package mention', () => {
    expect(
      findIncompleteProList('the `@revealui/harnesses` Pro package coordinates agents', fsl, mit),
    ).toBeNull();
  });

  it('ignores mixed MIT + FSL prose (not an enumeration)', () => {
    expect(
      findIncompleteProList(
        'The Pro packages extend `@revealui/core` (MIT) — e.g. `@revealui/ai` and `@revealui/harnesses`',
        fsl,
        mit,
      ),
    ).toBeNull();
  });

  it('ignores lines with no Pro/FSL context', () => {
    expect(
      findIncompleteProList('@revealui/ai and @revealui/harnesses are used here', fsl, mit),
    ).toBeNull();
  });
});

describe('countCliTemplates', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claim-drift-tpl-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('counts template directories that ship a package.json', () => {
    for (const name of ['basic-blog', 'starter']) {
      fs.mkdirSync(path.join(tmp, name));
      fs.writeFileSync(path.join(tmp, name, 'package.json'), '{}');
    }
    // A bare directory is not a scaffoldable template
    fs.mkdirSync(path.join(tmp, 'shared-assets'));
    expect(countCliTemplates(tmp)).toBe(2);
  });

  it('returns 0 when the templates directory is missing', () => {
    expect(countCliTemplates(path.join(tmp, 'does-not-exist'))).toBe(0);
  });
});

describe('CLI template claim patterns', () => {
  /**
   * Mirrors scanForClaims semantics: first matching pattern on a line wins
   * and capture group 1 carries the claimed count. null = no pattern matched.
   */
  function claimedCount(line: string): number | null {
    for (const pattern of CLI_TEMPLATE_CLAIM_PATTERNS) {
      const match = pattern.exec(line);
      if (match) return Number.parseInt(match[1], 10);
    }
    return null;
  }

  it('matches "ships N templates" prose', () => {
    expect(claimedCount('`@revealui/cli` ships 5 templates (`basic-blog`, `e-commerce`)')).toBe(5);
  });

  it('captures the template count, not the repo count, in the ROADMAP launch bullet', () => {
    expect(
      claimedCount(
        '- **5 CLI templates** (basic-blog, e-commerce, portfolio, starter, starter-native)  -  4 published as standalone template repos',
      ),
    ).toBe(5);
  });

  it('does not match the standalone-template-repo phrasing (GitHub fact, not a filesystem count)', () => {
    expect(claimedCount('4 published as standalone template repos')).toBeNull();
    expect(claimedCount('4 standalone template repos')).toBeNull();
    expect(claimedCount('4 template repos under the RevealUIStudio org')).toBeNull();
  });

  it('does not match "N templates repos" thanks to the repos lookahead', () => {
    expect(claimedCount('4 templates repos')).toBeNull();
    expect(claimedCount('4 templates repo mirrors')).toBeNull();
  });

  it('does not match singular "template" phrasing', () => {
    expect(claimedCount('1 template directory was added')).toBeNull();
  });
});

describe('countTestFiles', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claim-drift-walk-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('counts test-suffixed files outside excluded directories', () => {
    fs.mkdirSync(path.join(tmp, 'packages', 'core', 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'packages', 'core', 'src', 'a.test.ts'), '');
    fs.writeFileSync(path.join(tmp, 'packages', 'core', 'src', 'b.spec.tsx'), '');
    fs.writeFileSync(path.join(tmp, 'packages', 'core', 'src', 'helper.ts'), '');
    expect(countTestFiles(tmp)).toBe(2);
  });

  it('skips gitignored artifact dirs at any depth (2026-06-11 stale-opensrc incident)', () => {
    fs.mkdirSync(path.join(tmp, 'src'));
    fs.writeFileSync(path.join(tmp, 'src', 'real.test.ts'), '');
    // Incident shape: a stale opensrc/ cache of fetched third-party sources
    const opensrc = path.join(tmp, 'opensrc', 'repos', 'github.com', 'colinhacks', 'zod', 'src');
    fs.mkdirSync(opensrc, { recursive: true });
    fs.writeFileSync(path.join(opensrc, 'fake.test.ts'), '');
    // Every excluded name, nested under an app dir to prove depth-independence
    for (const dir of WALK_EXCLUDED_DIRS) {
      const nested = path.join(tmp, 'apps', 'web', dir);
      fs.mkdirSync(nested, { recursive: true });
      fs.writeFileSync(path.join(nested, 'phantom.test.ts'), '');
    }
    expect(countTestFiles(tmp)).toBe(1);
  });

  it('skips path-shaped ignored dirs the name set cannot express (generated docs-mirror class)', () => {
    fs.mkdirSync(path.join(tmp, 'src'));
    fs.writeFileSync(path.join(tmp, 'src', 'real.test.ts'), '');
    // Generated-mirror shape: apps/docs/public/docs/ — "docs" is a normal
    // directory name, so WALK_EXCLUDED_DIRS must not (and does not) list it.
    const mirror = path.join(tmp, 'apps', 'docs', 'public', 'docs');
    fs.mkdirSync(mirror, { recursive: true });
    fs.writeFileSync(path.join(mirror, 'copied.test.ts'), '');

    // Without the git-derived set the mirror inflates the count…
    expect(countTestFiles(tmp)).toBe(2);
    // …with it, the walker prunes at the collapsed directory entry.
    const isIgnored = makeIgnoredPathPredicate(tmp, new Set(['apps/docs/public/docs']));
    expect(countTestFiles(tmp, isIgnored)).toBe(1);
  });

  it('skips pattern-shaped ignored files inside scanned dirs (report-artifact class)', () => {
    fs.mkdirSync(path.join(tmp, 'docs'));
    fs.writeFileSync(path.join(tmp, 'docs', 'kept.test.ts'), '');
    fs.writeFileSync(path.join(tmp, 'docs', 'STALE_REPORT.test.ts'), '');

    expect(countTestFiles(tmp)).toBe(2);
    // File-granular skip: exactly the listed file, nothing else.
    const isIgnored = makeIgnoredPathPredicate(tmp, new Set(['docs/STALE_REPORT.test.ts']));
    expect(countTestFiles(tmp, isIgnored)).toBe(1);
  });

  it('GAP-399: walker skips a nested .wt/ full-checkout phantom (name exclusion)', () => {
    fs.mkdirSync(path.join(tmp, 'packages', 'core'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'packages', 'core', 'real.test.ts'), '');
    // Incident shape: a peer worktree nested under the main checkout root
    // (fleet convention .wt/<label>) carrying a full second copy of tests.
    const phantom = path.join(tmp, '.wt', 'peer-session', 'packages', 'core');
    fs.mkdirSync(phantom, { recursive: true });
    fs.writeFileSync(path.join(phantom, 'phantom.test.ts'), '');
    fs.writeFileSync(path.join(phantom, 'another.spec.tsx'), '');
    // Without the durable name exclusion this would be 3.
    expect(countTestFiles(tmp)).toBe(1);
  });
});

describe('countTrackedFiles (GAP-399 durable path)', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claim-drift-git-ls-'));
    execFileSync('git', ['init', '-q'], { cwd: tmp });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: tmp });
    execFileSync('git', ['config', 'user.name', 'claim-drift fixture'], { cwd: tmp });
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  function commitTracked(rel: string, body = ''): void {
    const full = path.join(tmp, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
    execFileSync('git', ['add', rel], { cwd: tmp });
    execFileSync('git', ['commit', '-q', '-m', `add ${rel}`], { cwd: tmp });
  }

  it('counts only index-tracked test files (ignores untracked .wt/ phantoms)', () => {
    commitTracked('packages/core/real.test.ts');
    // Untracked nested worktree copy — never enters the index.
    const phantom = path.join(tmp, '.wt', 'peer', 'packages', 'core');
    fs.mkdirSync(phantom, { recursive: true });
    fs.writeFileSync(path.join(phantom, 'phantom.test.ts'), '');
    fs.writeFileSync(path.join(phantom, 'extra.spec.ts'), '');

    const match = (rel: string) => TEST_FILE_SUFFIXES.some((s) => rel.endsWith(s));
    expect(countTrackedFiles(tmp, match)).toBe(1);
    // Filesystem walk without exclusions would see 3; durable path stays at 1.
  });

  it('returns null when the path is not a git work tree', () => {
    const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'claim-drift-nogit-'));
    try {
      expect(countTrackedFiles(bare, () => true)).toBeNull();
    } finally {
      fs.rmSync(bare, { recursive: true, force: true });
    }
  });

  it('repo-root countTestFiles matches git ls-files (tracked-files basis)', () => {
    // Integration check against the real monorepo: both paths must agree so
    // the durable switch cannot silently drift from the walk-era baseline
    // when no nested .wt/ is present.
    const repoRoot = path.resolve(import.meta.dirname, '../../..');
    const viaDefault = countTestFiles(repoRoot);
    const viaGit = countTrackedFiles(repoRoot, (rel) =>
      TEST_FILE_SUFFIXES.some((s) => rel.endsWith(s)),
    );
    expect(viaGit).not.toBeNull();
    expect(viaDefault).toBe(viaGit);
  });
});

describe('parseGitIgnoredOutput', () => {
  it('splits on NUL and strips the trailing slash from collapsed directories', () => {
    const raw = 'apps/docs/public/docs/\0docs/LOCAL_VERIFICATION.md\0node_modules/\0';
    expect(parseGitIgnoredOutput(raw)).toEqual(
      new Set(['apps/docs/public/docs', 'docs/LOCAL_VERIFICATION.md', 'node_modules']),
    );
  });

  it('returns an empty set for empty output', () => {
    expect(parseGitIgnoredOutput('')).toEqual(new Set());
  });
});

describe('makeIgnoredPathPredicate', () => {
  const base = path.join(os.tmpdir(), 'claim-drift-pred-fixture');

  it('matches files and collapsed directories by base-relative path', () => {
    const isIgnored = makeIgnoredPathPredicate(
      base,
      new Set(['generated/docs', 'docs/STALE_REPORT.md']),
    );
    expect(isIgnored(path.join(base, 'generated', 'docs'))).toBe(true);
    expect(isIgnored(path.join(base, 'docs', 'STALE_REPORT.md'))).toBe(true);
    expect(isIgnored(path.join(base, 'docs', 'CURRENT.md'))).toBe(false);
    expect(isIgnored(path.join(base, 'generated'))).toBe(false);
  });

  it('never matches when the ignored set is empty', () => {
    const isIgnored = makeIgnoredPathPredicate(base, new Set());
    expect(isIgnored(path.join(base, 'anything.md'))).toBe(false);
  });
});

describe('WALK_EXCLUDED_DIRS', () => {
  const repoRoot = path.resolve(import.meta.dirname, '../../..');

  it('every entry except .git has a covering .gitignore line', () => {
    const gitignore = fs.readFileSync(path.join(repoRoot, '.gitignore'), 'utf8');
    const covered = new Set<string>();
    for (const raw of gitignore.split('\n')) {
      const line = raw.trim();
      if (line.length === 0 || line.startsWith('#') || line.startsWith('!')) continue;
      let name = line;
      if (name.startsWith('**/')) name = name.slice('**/'.length);
      if (name.endsWith('/')) name = name.slice(0, -1);
      covered.add(name);
    }
    for (const dir of WALK_EXCLUDED_DIRS) {
      if (dir === '.git') continue;
      expect(covered.has(dir), `"${dir}" is walker-excluded but not gitignored`).toBe(true);
    }
  });

  it('no entry shadows git-tracked files (e.g. screenshots/ must stay walkable)', () => {
    const tracked = execFileSync('git', ['ls-files'], {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    const shadowed = new Set<string>();
    for (const file of tracked.split('\n')) {
      for (const segment of file.split('/')) {
        if (WALK_EXCLUDED_DIRS.has(segment)) shadowed.add(file);
      }
    }
    expect([...shadowed]).toEqual([]);
  });
});

describe('findLicenseSplitAntiPattern', () => {
  it('flags the canonical equation form', () => {
    expect(findLicenseSplitAntiPattern('21 published + 5 private')).toBe('N published + M private');
    expect(findLicenseSplitAntiPattern('Pre-launch: 21 published + 5 private = 26')).toBe(
      'N published + M private',
    );
  });

  it('flags bare "N published packages"', () => {
    expect(findLicenseSplitAntiPattern('21 published packages on npm')).toBe(
      'N published packages',
    );
    expect(findLicenseSplitAntiPattern('We ship 25 published package adapters.')).toBe(
      'N published packages',
    );
  });

  it('flags bare "N private packages"', () => {
    expect(findLicenseSplitAntiPattern('5 private packages internal to the suite')).toBe(
      'N private packages',
    );
  });

  it('does NOT flag the canonical taxonomy phrasing', () => {
    expect(findLicenseSplitAntiPattern('20 of 26 packages are MIT')).toBeNull();
    expect(findLicenseSplitAntiPattern('5 Pro packages are Fair Source (FSL-1.1-MIT)')).toBeNull();
    expect(findLicenseSplitAntiPattern('20 MIT + 5 FSL + 1 internal = 26')).toBeNull();
  });

  it('does NOT flag prose that happens to use "published" without a package count', () => {
    expect(findLicenseSplitAntiPattern('Packages are published to npm.')).toBeNull();
    expect(
      findLicenseSplitAntiPattern('See SLSA Build Level 2 provenance on published packages'),
    ).toBeNull();
    expect(findLicenseSplitAntiPattern('private function defined here')).toBeNull();
  });

  it('equation form takes precedence over bare forms', () => {
    // A line that contains both halves should report the equation shape, not
    // "N published packages" — otherwise multi-flagging clutters the report.
    expect(findLicenseSplitAntiPattern('21 published + 5 private packages')).toBe(
      'N published + M private',
    );
  });
});

describe('AGENT_COMMERCE_BLOCKLIST (x402 / marketplace presented as live)', () => {
  const tokenFor = (needle: string): RegExp => {
    const entry = AGENT_COMMERCE_BLOCKLIST.find((e) => e.label.includes(needle));
    if (!entry) throw new Error(`no agent-commerce blocklist entry for ${needle}`);
    return entry.token;
  };
  const x402 = tokenFor('x402');
  const market = tokenFor('marketplace');

  it('flags x402 presented as live but not neutral mentions', () => {
    expect(x402.test('Big news: x402 is live today for every caller')).toBe(true);
    expect(x402.test('x402 payments are available now')).toBe(true);
    expect(x402.test('the x402 protocol, developed by Coinbase')).toBe(false);
    expect(x402.test('## How x402 Works')).toBe(false);
    expect(x402.test('the endpoints are code-complete behind X402_ENABLED=false')).toBe(false);
    expect(
      x402.test('x402 micropayments (USDC on Base) are designed but not transactable today'),
    ).toBe(false);
  });

  it('flags the agent/MCP marketplace presented as live, not a template marketplace', () => {
    expect(market.test('the agent marketplace is open for publishing')).toBe(true);
    expect(market.test('RevMarket is live today')).toBe(true);
    expect(market.test('the MCP marketplace discovery document lists every server')).toBe(false);
    expect(market.test('a template marketplace is available for plugins')).toBe(false);
  });
});

describe('isRoadmapDeclaredFile', () => {
  const fm = (body: string): string => `---
${body}
---

body text
`;

  it('exempts a file that declares roadmap status WITH a tracker', () => {
    expect(isRoadmapDeclaredFile(fm('roadmap: "Coming soon: x402 #93"'))).toBe(true);
    expect(isRoadmapDeclaredFile(fm('lifecycle: "roadmap, tracked in #526"'))).toBe(true);
  });

  it('does not exempt an unlinked declaration or a non-frontmatter file', () => {
    expect(isRoadmapDeclaredFile(fm('roadmap: "Coming soon"'))).toBe(false);
    expect(isRoadmapDeclaredFile('no frontmatter, roadmap: see #93')).toBe(false);
    expect(isRoadmapDeclaredFile(fm('title: "no roadmap key here"'))).toBe(false);
  });
});
