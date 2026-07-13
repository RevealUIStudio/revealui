// console-allowed
/**
 * Marketing Voice Validator — banned-word + voice-register CI gate.
 *
 * Enforces the voice-and-headline-rules corpus on customer-facing
 * marketing copy in `apps/marketing/app`:
 *
 *   - §4.1 banned hype words / phrases   → `hype-word`, `hype-phrase`
 *   - §4.1 punctuation bans (emoji, `!`) → `punctuation`
 *   - owner style: no em dashes in copy  → `em-dash`
 *   - §4.2 internal-codename leaks       → `codename`
 *   - §2 / §4.3 / §5 fleet voice register → `fleet-voice`
 *     (no first-person-plural studio voice on fleet pages; `for-operators/*`
 *      and `blog` surfaces are exempt per corpus §2.1)
 *
 * Implements the banned-word scan + fleet/agency voice-register split the
 * corpus §5 maintenance note calls for. Self-contained like its sibling
 * validators (`claim-drift.ts`, the fleet doc-currency scanner): node built-ins
 * + `Intl.Segmenter` only, zero authored regex (the fleet no-regex hardline).
 * The shared `@revealui/contracts/marketing-voice` engine is the eventual
 * consolidation home once GAP-192 retires the regex detectors in
 * `claim-drift.ts`; this gate stays dependency-light by design.
 *
 * Scope split (false-positive control on a hard-fail gate):
 *   - hype + punctuation: `content/*.ts` data modules only. Route/component
 *     `.tsx` carry Tailwind classNames ("transition-transform") that collide
 *     with hype tokens, so they are out of scope for those rules.
 *   - codename + voice: every marketing file — those tokens never collide
 *     with class names.
 *   - em-dash: every marketing file — the character never appears in class
 *     names, and comment lines (including JSX comments) are skipped.
 *   - `content/claims-evidence.ts` is exempt from every rule above (see
 *     `isClaimsEvidenceIndex`): it is the claims registry, not copy — it
 *     quotes other content files' prose verbatim so the register rules would
 *     double-count real (or already-baselined) findings at the index's own
 *     file:line. The copy it quotes still runs through the normal scan via
 *     the content file it was copied from.
 *
 * A baseline (`marketing-voice-baseline.json`) grandfathers the current
 * corpus; CI fails only on NEW `(file::ruleId::token)` triples. Shrinking the
 * baseline = progress (the gitleaks / doc-currency pattern).
 *
 * Usage:
 *   pnpm validate:marketing-voice                    # CI mode (exit 1 on new)
 *   pnpm validate:marketing-voice --update-baseline  # regenerate the baseline
 *
 * Exit codes: 0 = no new violations; 1 = new violations found.
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '../..');
const BASELINE_PATH = path.join(ROOT, 'scripts/validate/marketing-voice-baseline.json');
const UPDATE_BASELINE = process.argv.includes('--update-baseline');

// ---------------------------------------------------------------------------
// Tokenizer — Intl.Segmenter word granularity (mirrors the shared
// @revealui/contracts/marketing-voice tokenizer, inlined to stay self-
// contained). No authored regex.
// ---------------------------------------------------------------------------

export interface Token {
  text: string;
  kind: 'word' | 'symbol' | 'whitespace';
  offset: number;
}

const SEGMENTER = new Intl.Segmenter('en', { granularity: 'word' });

export function tokenize(text: string): Token[] {
  const out: Token[] = [];
  for (const part of SEGMENTER.segment(text)) {
    const isWord = (part as Intl.SegmentData & { isWordLike?: boolean }).isWordLike === true;
    out.push({
      text: part.segment,
      kind: isWord ? 'word' : part.segment.trim() === '' ? 'whitespace' : 'symbol',
      offset: part.index,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Rule data — derived verbatim from the corpus §4.1 / §4.2.
//
// Context-caveated words the corpus explicitly allows in technical prose
// (`optimize`, `leverage`, `AI-native`, `AI-first`, `smart`) are intentionally
// NOT banned — a blanket ban would be wrong per the corpus's own caveat.
// Generic connectives (`the only`, `the leading`) are omitted: too common in
// honest prose to hard-fail on (claim-drift's "prefer false-negatives on a
// hard-fail gate" philosophy).
// ---------------------------------------------------------------------------

/** §4.1 single-word hype adjectives + verbs (case-insensitive). */
export const HYPE_WORDS: ReadonlySet<string> = new Set([
  'revolutionary',
  'groundbreaking',
  'seamless',
  'frictionless',
  'effortless',
  'intuitive',
  'powerful',
  'robust',
  'comprehensive',
  'extensive',
  'empower',
  'unlock',
  'elevate',
  'transform',
  'revolutionize',
  'supercharge',
  'accelerate',
  'amplify',
  'streamline',
  'intelligent',
]);

/** §4.1 multi-word / hyphenated hype phrases (lowercased token sequences). */
export const HYPE_SEQUENCES: ReadonlyArray<readonly string[]> = [
  ['game', 'changing'],
  ['cutting', 'edge'],
  ['next', 'generation'],
  ['world', 'class'],
  ['best', 'in', 'class'],
  ['industry', 'leading'],
  ['state', 'of', 'the', 'art'],
  ['enterprise', 'grade'],
  ['battle', 'tested'],
  ['production', 'grade'],
  ['mission', 'critical'],
  ['blazingly', 'fast'],
  ['lightning', 'fast'],
  ['ai', 'powered'],
  ['the', 'future', 'of'],
  ["world's", 'most'],
  ['built', 'for', 'the', 'modern'],
  ['designed', 'for', 'ambitious'],
  ['the', 'premier'],
];

/**
 * §4.2 internal-codename leaks (case-SENSITIVE — proper-noun codenames).
 * `Forge` bare only: "RevForge" tokenizes as one word and never matches.
 */
export const CODENAME_WORDS: ReadonlySet<string> = new Set(['RevealCoin', 'RVUI', 'RVC', 'Forge']);

/** §4.2 codename token sequences (case-insensitive). */
export const CODENAME_SEQUENCES: ReadonlyArray<readonly string[]> = [
  ['forge', 'stamp'],
  ['token', '2022'],
];

/**
 * §4.3 fleet voice register — the agency's first-person engagement-verb voice
 * ("we build", "we ship", …) leaking onto fleet pages. Encoded as verb
 * SEQUENCES, not bare `we`/`us`/`our`: bare first-person is legitimate company
 * voice on legal, contact, and FAQ pages (S3's author-attribution exception),
 * so flagging it floods false positives. The construction the corpus actually
 * targets (§2 "We build…", §4.3 leak) is the studio engagement verb after
 * "we". Allowed on `for-operators/*` + `blog` surfaces (studio voice by
 * design, corpus §2.1).
 */
export const VOICE_SEQUENCES: ReadonlyArray<readonly string[]> = [
  ['we', 'build'],
  ['we', 'ship'],
  ['we', 'design'],
  ['we', 'deliver'],
  ['we', 'maintain'],
  ['we', 'integrate'],
  ['we', 'productionize'],
  ['we', 'scope'],
  ['we', 'start'],
];

// ---------------------------------------------------------------------------
// Matchers (pure)
// ---------------------------------------------------------------------------

export interface RawFinding {
  ruleId: string;
  /** Lowercased offending token or phrase — stable baseline key component. */
  token: string;
}

function isLetter(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z');
}

/** True when an emoji codepoint (Supplementary Multilingual Plane emoji blocks)
 *  appears in `text`. Arrows (→) and ✅/❌ iconography (BMP) are intentionally
 *  excluded — the corpus uses arrows in CTAs and renders check marks as SVG. */
export function hasEmoji(text: string): boolean {
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp !== undefined && cp >= 0x1f000 && cp <= 0x1faff) return true;
  }
  return false;
}

/** True when `line` contains a sentence-ending `!` (preceded by a letter or a
 *  quote) — distinguishes copy ("Ship today!") from code negation ("!ready"). */
export function hasSentenceExclamation(line: string): boolean {
  for (let i = 1; i < line.length; i++) {
    if (line[i] !== '!') continue;
    const prev = line[i - 1] ?? '';
    if (isLetter(prev) || prev === '"' || prev === "'" || prev === '`' || prev === '’') return true;
  }
  return false;
}

/** U+2014 em dash, constructed from its code point so this validator's own
 *  source never carries the raw character. Banned in customer copy (owner
 *  writing style: use a comma, colon, or period instead). */
const EM_DASH = String.fromCodePoint(0x2014);

export function hasEmDash(text: string): boolean {
  return text.includes(EM_DASH);
}

/** Find a lowercased token `sequence` as a contiguous run within `lowerWords`. */
export function matchesSequence(
  lowerWords: readonly string[],
  sequence: readonly string[],
): boolean {
  if (sequence.length === 0) return false;
  for (let i = 0; i + sequence.length <= lowerWords.length; i++) {
    let hit = true;
    for (let j = 0; j < sequence.length; j++) {
      if (lowerWords[i + j] !== sequence[j]) {
        hit = false;
        break;
      }
    }
    if (hit) return true;
  }
  return false;
}

export interface LineScanOptions {
  /** Scan hype words/phrases (content files only — className collision). */
  scanHype: boolean;
  /** Scan punctuation bans (content files only). */
  scanPunctuation: boolean;
  /** Scan fleet voice register (non-exempt fleet files). */
  scanVoice: boolean;
}

/** Collect rule findings for one source line. Pure + exported for tests. */
export function scanLine(line: string, opts: LineScanOptions): RawFinding[] {
  const trimmed = line.trimStart();
  if (
    trimmed.startsWith('import ') ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('{/*') ||
    trimmed.startsWith('*')
  ) {
    return [];
  }

  const findings: RawFinding[] = [];
  const tokens = tokenize(line);
  const words = tokens.filter((t) => t.kind === 'word');
  const lowerWords = words.map((w) => w.text.toLowerCase());

  // Codenames — every marketing file.
  for (const w of words) {
    if (CODENAME_WORDS.has(w.text)) {
      findings.push({ ruleId: 'codename', token: w.text.toLowerCase() });
    }
  }
  for (const seq of CODENAME_SEQUENCES) {
    if (matchesSequence(lowerWords, seq)) {
      findings.push({ ruleId: 'codename', token: seq.join(' ') });
    }
  }

  // Em dashes — every marketing file (owner style: comma/colon/period in copy).
  // Comment lines, including JSX comments, are already skipped above.
  if (hasEmDash(line)) {
    findings.push({ ruleId: 'em-dash', token: 'em-dash' });
  }

  // Fleet voice register — non-exempt fleet files.
  if (opts.scanVoice) {
    for (const seq of VOICE_SEQUENCES) {
      if (matchesSequence(lowerWords, seq)) {
        findings.push({ ruleId: 'fleet-voice', token: seq.join(' ') });
      }
    }
  }

  // Hype — content data modules only.
  if (opts.scanHype) {
    for (const lw of lowerWords) {
      if (HYPE_WORDS.has(lw)) findings.push({ ruleId: 'hype-word', token: lw });
    }
    for (const seq of HYPE_SEQUENCES) {
      if (matchesSequence(lowerWords, seq)) {
        findings.push({ ruleId: 'hype-phrase', token: seq.join(' ') });
      }
    }
  }

  // Punctuation — content data modules only.
  if (opts.scanPunctuation) {
    if (hasSentenceExclamation(line))
      findings.push({ ruleId: 'punctuation', token: 'exclamation' });
    for (const t of tokens) {
      if (t.kind === 'symbol' && hasEmoji(t.text)) {
        findings.push({ ruleId: 'punctuation', token: 'emoji' });
        break;
      }
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// File scoping
// ---------------------------------------------------------------------------

const MARKETING_APP = 'apps/marketing/app';
const SCAN_SUBDIRS = ['content', 'components', 'routes', 'layouts'];

/**
 * The claims-evidence index (`content/claims-evidence.ts`) quotes copy
 * verbatim from the files it indexes — that is the entire point of
 * exact-text pinning (see claims-evidence.ts's own header comment). It is
 * not customer-facing copy itself, so running the register rules over it is
 * a false-positive generator: a quoted sentence trips hype/codename/voice
 * findings at the INDEX's file:line in addition to the real finding (or
 * baseline entry) at the copy's own file:line, and the only way to silence
 * the duplicate was to paraphrase the pin away from the exact text it exists
 * to preserve. The copy it indexes still goes through the normal scan via
 * `COVERED_FILES` in claims-evidence.ts, so exempting this one file does not
 * reduce voice coverage of the site.
 */
const CLAIMS_EVIDENCE_INDEX_REL = 'apps/marketing/app/content/claims-evidence.ts';

export function isClaimsEvidenceIndex(rel: string): boolean {
  return rel === CLAIMS_EVIDENCE_INDEX_REL;
}

/** `for-operators/*` + blog surfaces speak in the studio's first-person voice
 *  by design (corpus §2.1) — exempt from the fleet-voice register rule. */
export function isVoiceExempt(rel: string): boolean {
  const lower = rel.toLowerCase();
  return lower.includes('for-operators') || lower.includes('blog');
}

/** Content data modules carry prose as string constants and no classNames. */
export function isContentFile(rel: string): boolean {
  return rel.includes('/content/');
}

function isScannable(name: string): boolean {
  if (name.endsWith('.d.ts')) return false;
  if (name.endsWith('.test.ts') || name.endsWith('.test.tsx')) return false;
  if (name === 'types.ts') return false;
  return name.endsWith('.ts') || name.endsWith('.tsx');
}

function walkFiles(dir: string, out: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name === '__tests__' || e.name === 'node_modules') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkFiles(full, out);
    else if (isScannable(e.name)) out.push(full);
  }
}

// ---------------------------------------------------------------------------
// Scan
// ---------------------------------------------------------------------------

export interface Finding {
  file: string;
  line: number;
  ruleId: string;
  token: string;
  text: string;
}

export function baselineKey(f: Pick<Finding, 'file' | 'ruleId' | 'token'>): string {
  return `${f.file}::${f.ruleId}::${f.token}`;
}

function scanFile(absPath: string): Finding[] {
  const rel = path.relative(ROOT, absPath).split(path.sep).join('/');
  if (isClaimsEvidenceIndex(rel)) return [];
  const content = fs.readFileSync(absPath, 'utf8');
  const lines = content.split('\n');
  const content_ = isContentFile(rel);
  const opts: LineScanOptions = {
    scanHype: content_,
    scanPunctuation: content_,
    scanVoice: !isVoiceExempt(rel),
  };
  const findings: Finding[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    for (const raw of scanLine(line, opts)) {
      findings.push({
        file: rel,
        line: i + 1,
        ruleId: raw.ruleId,
        token: raw.token,
        text: line.trim(),
      });
    }
  }
  return findings;
}

export function scanAll(): Finding[] {
  const files: string[] = [];
  for (const sub of SCAN_SUBDIRS) {
    walkFiles(path.join(ROOT, MARKETING_APP, sub), files);
  }
  files.sort();
  const findings: Finding[] = [];
  for (const f of files) findings.push(...scanFile(f));
  return findings;
}

// ---------------------------------------------------------------------------
// Baseline
// ---------------------------------------------------------------------------

interface BaselineFile {
  note: string;
  count: number;
  keys: string[];
}

function loadBaseline(): Set<string> {
  try {
    const parsed = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')) as BaselineFile;
    return new Set(parsed.keys);
  } catch {
    return new Set();
  }
}

function writeBaseline(findings: Finding[]): number {
  const keys = [...new Set(findings.map(baselineKey))].sort();
  const body: BaselineFile = {
    note: 'Grandfathered marketing-voice occurrences. Regenerate via `pnpm validate:marketing-voice --update-baseline`. Each key is a (file::ruleId::token) triple known to exist as of generation; CI fails only on NEW triples. Shrinking this list = progress.',
    count: keys.length,
    keys,
  };
  fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(body, null, 2)}\n`);
  return keys.length;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function run(): void {
  console.log('Marketing Voice Validator');
  console.log('=========================\n');

  const findings = scanAll();

  if (UPDATE_BASELINE) {
    const n = writeBaseline(findings);
    console.log(`Baseline regenerated: ${n} grandfathered (file::ruleId::token) keys.`);
    return;
  }

  const baseline = loadBaseline();
  const seen = new Set<string>();
  const fresh: Finding[] = [];
  for (const f of findings) {
    const key = baselineKey(f);
    if (baseline.has(key)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    fresh.push(f);
  }

  const distinct = new Set(findings.map(baselineKey)).size;
  console.log(
    `Scanned ${MARKETING_APP}: ${findings.length} occurrences, ${distinct} distinct, ${baseline.size} grandfathered, ${fresh.length} new.\n`,
  );

  if (fresh.length === 0) {
    console.log('No new marketing-voice violations. ✓');
    return;
  }

  console.error(
    'New marketing-voice violations (fix the copy, or justify + run --update-baseline):\n',
  );
  for (const f of fresh) {
    console.error(`  ${f.file}:${f.line}  [${f.ruleId}] ${f.token}`);
    console.error(`    ${f.text}`);
  }
  console.error(
    `\n${fresh.length} new violation(s). See the voice-and-headline-rules corpus (§4.1 banned words, §4.2 codenames, §2/§4.3 fleet voice) and the no-em-dash style rule (use a comma, colon, or period).`,
  );
  process.exitCode = 1;
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) run();
