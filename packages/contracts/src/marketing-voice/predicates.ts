import type { Token } from './tokenize.js';

export const ENGAGEMENT_UNITS: Set<string> = new Set(['engagement', 'project', 'mo', 'week']);
export const PRICING_TIER_BLOCK_KINDS: Set<string> = new Set(['PricingTracks']);

export function stripCommas(s: string): string {
  return s.split(',').join('');
}

export function isDollarShape(t: Token): boolean {
  if (!t.text.startsWith('$')) return false;
  const num = Number(stripCommas(t.text.slice(1)));
  return Number.isFinite(num);
}

export function isPercentShape(t: Token, next: Token | undefined): boolean {
  if (t.text.endsWith('%')) {
    return Number.isFinite(Number(t.text.slice(0, -1)));
  }
  return Number.isFinite(Number(t.text)) && next?.text === '%';
}

export function isUsdShape(t: Token, next: Token | undefined): boolean {
  return Number.isFinite(Number(t.text)) && next?.text.toLowerCase() === 'usd';
}

export function isEngagementUnit(t: Token): boolean {
  return ENGAGEMENT_UNITS.has(t.text.toLowerCase());
}

export function isPositiveIntegerToken(t: Token): boolean {
  const n = Number(t.text);
  return Number.isInteger(n) && n > 0;
}

export function isIntegerWithCommas(t: Token): boolean {
  const segments = t.text.split(',');
  if (!segments.every((seg) => seg.length > 0 && Number.isInteger(Number(seg)))) return false;
  return Number.isFinite(Number(stripCommas(t.text)));
}

function isAllDigits(s: string): boolean {
  if (s.length === 0) return false;
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code < 48 || code > 57) return false;
  }
  return true;
}

export function isTrackerToken(t: Token, next: Token | undefined): boolean {
  if (t.text === '#' && next !== undefined && isAllDigits(next.text)) return true;
  const lower = t.text.toLowerCase();
  if (lower === 'milestone' || lower === 'milestones') return true;
  if (t.text.endsWith('.yml') || t.text.endsWith('.yaml')) return true;
  return false;
}

export function isRepoLinkToken(text: string): boolean {
  let pathname: string;
  try {
    pathname = new URL(text, 'file:///').pathname;
  } catch {
    return false;
  }
  const segments = pathname.split('/').filter(Boolean);
  for (let i = 0; i < segments.length - 1; i++) {
    if (segments[i] === 'RevealUIStudio') return true;
  }
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    const next = segments[i + 1];
    if (next === undefined) continue;
    if (seg === 'issues' || seg === 'pull' || seg === 'pulls') {
      if (isAllDigits(next)) return true;
    }
  }
  return false;
}

export function isAdrFilename(filename: string): boolean {
  if (!filename.endsWith('.md')) return false;
  const stem = filename.slice(0, -3);
  const parts = stem.split('-');
  if (parts.length < 4) return false;
  const yyyy = parts[0] ?? '';
  const mm = parts[1] ?? '';
  const dd = parts[2] ?? '';
  const rest = parts.slice(3);
  if (yyyy.length !== 4 || mm.length !== 2 || dd.length !== 2) return false;
  if (
    !Number.isFinite(Number(yyyy)) ||
    !Number.isFinite(Number(mm)) ||
    !Number.isFinite(Number(dd))
  )
    return false;
  if (Number.isNaN(Date.parse(`${yyyy}-${mm}-${dd}`))) return false;
  return rest.length > 0 && rest.every((seg) => seg.length > 0);
}

export function isAdrCitePath(linkUrl: string): boolean {
  let pathname: string;
  try {
    pathname = new URL(linkUrl, 'file:///').pathname;
  } catch {
    return false;
  }
  const segments = pathname.split('/').filter(Boolean);
  const idxDecisions = segments.findIndex(
    (s, i) => s === 'docs' && segments[i + 1] === 'decisions',
  );
  if (idxDecisions === -1) return false;
  const last = segments[segments.length - 1];
  if (last === undefined) return false;
  return isAdrFilename(last);
}

export function isPricingTierSourceBlock(block: { type: string }): boolean {
  return PRICING_TIER_BLOCK_KINDS.has(block.type);
}
