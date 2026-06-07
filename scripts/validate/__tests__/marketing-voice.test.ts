import { describe, expect, it } from 'vitest';
import {
  baselineKey,
  hasEmoji,
  hasSentenceExclamation,
  isContentFile,
  isVoiceExempt,
  type LineScanOptions,
  matchesSequence,
  scanLine,
  tokenize,
} from '../marketing-voice.js';

const CONTENT: LineScanOptions = { scanHype: true, scanPunctuation: true, scanVoice: true };
const TSX: LineScanOptions = { scanHype: false, scanPunctuation: false, scanVoice: true };
const EXEMPT: LineScanOptions = { scanHype: true, scanPunctuation: true, scanVoice: false };

function ruleIds(line: string, opts: LineScanOptions): string[] {
  return scanLine(line, opts).map((f) => f.ruleId);
}
function hits(line: string, opts: LineScanOptions): string[] {
  return scanLine(line, opts).map((f) => `${f.ruleId}:${f.token}`);
}

describe('tokenize', () => {
  it('splits hyphenated words but keeps contractions whole', () => {
    expect(
      tokenize('cutting-edge')
        .filter((t) => t.kind === 'word')
        .map((t) => t.text),
    ).toEqual(['cutting', 'edge']);
    expect(
      tokenize("we're")
        .filter((t) => t.kind === 'word')
        .map((t) => t.text),
    ).toEqual(["we're"]);
  });
});

describe('matchesSequence', () => {
  it('matches a contiguous run, order-sensitive', () => {
    expect(matchesSequence(['the', 'future', 'of', 'ai'], ['the', 'future', 'of'])).toBe(true);
    expect(matchesSequence(['future', 'the', 'of'], ['the', 'future', 'of'])).toBe(false);
    expect(matchesSequence(['x'], [])).toBe(false);
  });
});

describe('scanLine — hype', () => {
  it('flags a single hype word in content scope', () => {
    expect(hits("  metric: 'A powerful runtime',", CONTENT)).toContain('hype-word:powerful');
  });
  it('flags a hyphenated hype phrase', () => {
    expect(hits("  tagline: 'cutting-edge tooling',", CONTENT)).toContain(
      'hype-phrase:cutting edge',
    );
  });
  it('does NOT scan hype outside content scope (Tailwind className collision guard)', () => {
    // "transition-transform" tokenizes to ["transition","transform"]; "transform"
    // is a hype word but must not fire on a route/component className.
    expect(ruleIds('<div className="transition-transform" />', TSX)).not.toContain('hype-word');
  });
});

describe('scanLine — codename', () => {
  it('flags bare RVUI and bare Forge but never RevForge', () => {
    expect(hits("  body: 'pay with RVUI tokens',", CONTENT)).toContain('codename:rvui');
    expect(hits("  body: 'the Forge tier',", CONTENT)).toContain('codename:forge');
    expect(ruleIds("  body: 'RevForge trial kits',", CONTENT)).not.toContain('codename');
  });
  it('flags the forge-stamp sequence', () => {
    expect(hits("  value: 'forge-stamp',", CONTENT)).toContain('codename:forge stamp');
  });
  it('scans codenames even in tsx scope (no className collision)', () => {
    expect(ruleIds("  const t = 'RevealCoin';", TSX)).toContain('codename');
  });
});

describe('scanLine — fleet voice register', () => {
  it('flags the agency engagement-verb construction "we build"', () => {
    expect(hits("  headline: 'We build your platform',", CONTENT)).toContain(
      'fleet-voice:we build',
    );
  });
  it('does NOT flag legitimate company voice ("we collect", "we process")', () => {
    expect(ruleIds("  body: 'We collect your email to reply.',", CONTENT)).not.toContain(
      'fleet-voice',
    );
  });
  it('does not scan voice on exempt (for-operators / blog) files', () => {
    expect(ruleIds("  headline: 'We build and deploy for you',", EXEMPT)).not.toContain(
      'fleet-voice',
    );
  });
});

describe('scanLine — punctuation (content only)', () => {
  it('flags a sentence-ending exclamation', () => {
    expect(ruleIds("  cta: 'Start today!',", CONTENT)).toContain('punctuation');
  });
  it('does not flag code negation', () => {
    expect(ruleIds('  if (!ready) return null;', CONTENT)).not.toContain('punctuation');
  });
  it('flags an emoji but not an arrow', () => {
    expect(ruleIds("  note: 'Launch 🚀',", CONTENT)).toContain('punctuation');
    expect(ruleIds("  cta: 'View services →',", CONTENT)).not.toContain('punctuation');
  });
});

describe('scanLine — skips imports and comments', () => {
  it('skips import lines even when they contain banned tokens', () => {
    expect(scanLine("import { powerful } from './x';", CONTENT)).toEqual([]);
  });
  it('skips comment lines', () => {
    expect(scanLine('  // a powerful, cutting-edge comment', CONTENT)).toEqual([]);
    expect(scanLine('   * jsdoc powerful line', CONTENT)).toEqual([]);
  });
});

describe('helpers', () => {
  it('hasEmoji distinguishes emoji from BMP symbols', () => {
    expect(hasEmoji('🚀')).toBe(true);
    expect(hasEmoji('→')).toBe(false);
    expect(hasEmoji('x')).toBe(false);
  });
  it('hasSentenceExclamation distinguishes copy from code', () => {
    expect(hasSentenceExclamation('Ship today!')).toBe(true);
    expect(hasSentenceExclamation('return !ready')).toBe(false);
  });
  it('isVoiceExempt covers for-operators and blog', () => {
    expect(isVoiceExempt('apps/marketing/app/content/for-operators.ts')).toBe(true);
    expect(isVoiceExempt('apps/marketing/app/routes/BlogPostPage.tsx')).toBe(true);
    expect(isVoiceExempt('apps/marketing/app/content/home.ts')).toBe(false);
  });
  it('isContentFile detects the content data modules', () => {
    expect(isContentFile('apps/marketing/app/content/home.ts')).toBe(true);
    expect(isContentFile('apps/marketing/app/routes/HomePage.tsx')).toBe(false);
  });
  it('baselineKey is a stable triple', () => {
    expect(baselineKey({ file: 'a.ts', ruleId: 'hype-word', token: 'powerful' })).toBe(
      'a.ts::hype-word::powerful',
    );
  });
});
