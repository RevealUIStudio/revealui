/**
 * Copy-dependent holds — feature-existence enforcement for claim honesty.
 *
 * IDs match private planning registry docs/marketing/copy-dependents.yml (.jv).
 * This file is the PUBLIC enforcement SSOT for validate:claims / claim-gates.
 *
 * status:
 *   waiting  — live-shipped phrasing for this capability is FORBIDDEN
 *   released — feature exists; detector inactive (keep id for history)
 *
 * When a feature ships: set status to released in the same PR that flips
 * customer copy, and cue the private .jv registry (COPY-DEP-* → cued/done).
 *
 * Detectors are word-window proximity walks (no authored regex), matching
 * claim-drift-engine agent-commerce style.
 */

export type CopyDependentStatus = 'waiting' | 'released';

export type CopyDependentDetector =
  | 'marketplace-live'
  | 'x402-live'
  | 'sso-live'
  | 'visual-builder-live'
  | 'ghcr-fleet-images-live'
  | 'saml-live';

export interface CopyDependentHold {
  readonly id: string;
  readonly status: CopyDependentStatus;
  readonly title: string;
  readonly detector: CopyDependentDetector;
  /** Why a live claim is dishonest while waiting. */
  readonly why: string;
  /** Public tracker (issue/PR) when available. */
  readonly publicTracker?: string;
}

/**
 * Active holds. waiting → fail claim-gates on live phrasing.
 * Keep released rows for id continuity with the private cue registry.
 */
export const COPY_DEPENDENT_HOLDS: readonly CopyDependentHold[] = [
  {
    id: 'COPY-DEP-MCP-MARKETPLACE',
    status: 'waiting',
    title: 'MCP Marketplace customer copy expansion',
    detector: 'marketplace-live',
    why: 'MCP / agent marketplace is Planned, not shipped as a live product surface',
    publicTracker: '#526',
  },
  {
    id: 'COPY-DEP-X402-LIVE',
    status: 'waiting',
    title: 'x402 live payments claims',
    detector: 'x402-live',
    why: 'x402 payments are gated (not live); no live/available claim until flag + product path ship',
    publicTracker: '#93',
  },
  {
    id: 'COPY-DEP-ENTERPRISE-SSO',
    status: 'released',
    title: 'Enterprise SSO / SAML customer copy',
    detector: 'sso-live',
    why: 'GAP-464 code on test (OIDC+SAML SP-initiated + Admin); live copy allowed under Enterprise gate honesty',
  },
  {
    id: 'COPY-DEP-ENTERPRISE-SAML',
    status: 'released',
    title: 'Enterprise SAML live claims',
    detector: 'saml-live',
    why: 'GAP-464 SAML SP path + Admin metadata config on test; live copy allowed with SCIM still non-goal',
  },
  {
    id: 'COPY-DEP-VISUAL-BUILDER',
    status: 'waiting',
    title: 'Visual Builder product copy',
    detector: 'visual-builder-live',
    why: 'Visual Builder is Planned: backlog; no live drag-and-drop builder claim',
    publicTracker: '#1816',
  },
  {
    id: 'COPY-DEP-FLEET-DOCKER-IMAGES',
    status: 'waiting',
    title: 'Self-hosted Docker / GHCR Fleet kit copy',
    detector: 'ghcr-fleet-images-live',
    why: 'Official GHCR Docker images for Fleet are Planned; no "images published" live claim',
  },
] as const;

export function activeCopyDependentHolds(): readonly CopyDependentHold[] {
  return COPY_DEPENDENT_HOLDS.filter((h) => h.status === 'waiting');
}

export interface CopyDependentHit {
  readonly holdId: string;
  readonly title: string;
  readonly why: string;
  readonly publicTracker?: string;
}

/** Word tokens only, lowercased (Segmenter-friendly hyphen splits already done by tokenize). */
function wordTexts(tokens: { kind: string; text: string }[]): string[] {
  const out: string[] = [];
  for (const t of tokens) {
    if (t.kind === 'word') out.push(t.text.toLowerCase());
  }
  return out;
}

const LIVE_STATUS = new Set([
  'live',
  'open',
  'available',
  'launched',
  'shipped',
  'ready',
  'enabled',
]);

function hasLiveCopula(words: string[], from: number, window: number): boolean {
  const hi = Math.min(words.length, from + window);
  for (let j = from; j < hi; j++) {
    if (words[j] !== 'is' && words[j] !== 'are' && words[j] !== 'now') continue;
    const a = words[j + 1];
    if (a !== undefined && LIVE_STATUS.has(a)) return true;
    if (a === 'in' && words[j + 2] === 'production') return true;
    if ((a === 'enabled' || a === 'working') && words[j + 2] === 'today') return true;
  }
  return false;
}

function marketplaceAnchorLen(words: string[], i: number): number {
  const w = words[i];
  if (w === 'revmarket') return 1;
  if (w === 'agent') {
    if (words[i + 1] === 'marketplace') return 2;
    if (words[i + 1] === 'tool' && words[i + 2] === 'marketplace') return 3;
    return 0;
  }
  if (w === 'mcp') {
    if (words[i + 1] === 'marketplace') return 2;
    if (words[i + 1] === 'server' && words[i + 2] === 'marketplace') return 3;
    return 0;
  }
  return 0;
}

function detectMarketplaceLive(words: string[]): boolean {
  for (let i = 0; i < words.length; i++) {
    const len = marketplaceAnchorLen(words, i);
    if (len === 0) continue;
    if (hasLiveCopula(words, i + len, 14)) return true;
  }
  return false;
}

function detectX402Live(words: string[]): boolean {
  for (let i = 0; i < words.length; i++) {
    if (words[i] !== 'x402') continue;
    if (hasLiveCopula(words, i + 1, 15)) return true;
  }
  return false;
}

/** "SSO is available/live" or "single sign on is live" — not bare "SSO" glossary. */
function detectSsoLive(words: string[]): boolean {
  for (let i = 0; i < words.length; i++) {
    let len = 0;
    if (words[i] === 'sso') len = 1;
    else if (words[i] === 'single' && words[i + 1] === 'sign' && words[i + 2] === 'on') {
      len = 3;
    }
    if (len === 0) continue;
    if (hasLiveCopula(words, i + len, 12)) return true;
  }
  return false;
}

function detectSamlLive(words: string[]): boolean {
  for (let i = 0; i < words.length; i++) {
    if (words[i] !== 'saml') continue;
    if (hasLiveCopula(words, i + 1, 12)) return true;
  }
  return false;
}

/** Visual Builder is live / available / shipped as a product (not "builder pattern"). */
function detectVisualBuilderLive(words: string[]): boolean {
  for (let i = 0; i < words.length; i++) {
    let len = 0;
    if (words[i] === 'visual' && words[i + 1] === 'builder') len = 2;
    else if (words[i] === 'no' && words[i + 1] === 'code' && words[i + 2] === 'builder') len = 3;
    else if (
      words[i] === 'drag' &&
      words[i + 1] === 'and' &&
      words[i + 2] === 'drop' &&
      words[i + 3] === 'builder'
    )
      len = 4;
    if (len === 0) continue;
    if (hasLiveCopula(words, i + len, 12)) return true;
  }
  return false;
}

/**
 * GHCR / Docker images as a LIVE product claim ("are live", "images are available").
 * Neutral roadmap descriptions ("images published to GHCR" under Planned) stay
 * allowed — they must use a live-status copula window, not bare "published".
 */
function detectGhcrFleetImagesLive(words: string[]): boolean {
  for (let i = 0; i < words.length; i++) {
    let len = 0;
    if (words[i] === 'ghcr') len = 1;
    else if (words[i] === 'github' && words[i + 1] === 'container' && words[i + 2] === 'registry') {
      len = 3;
    } else if (words[i] === 'official' && words[i + 1] === 'docker' && words[i + 2] === 'images') {
      len = 3;
    } else if (words[i] === 'docker' && words[i + 1] === 'images') {
      len = 2;
    }
    if (len === 0) continue;
    if (hasLiveCopula(words, i + len, 14)) return true;
  }
  return false;
}

function runDetector(detector: CopyDependentDetector, words: string[]): boolean {
  switch (detector) {
    case 'marketplace-live':
      return detectMarketplaceLive(words);
    case 'x402-live':
      return detectX402Live(words);
    case 'sso-live':
      return detectSsoLive(words);
    case 'saml-live':
      return detectSamlLive(words);
    case 'visual-builder-live':
      return detectVisualBuilderLive(words);
    case 'ghcr-fleet-images-live':
      return detectGhcrFleetImagesLive(words);
    default:
      return false;
  }
}

/**
 * Find active (waiting) copy-dependent hold hits on a single line.
 * `line` is the customer-facing string under audit; `tokens` must be the
 * Segmenter walk of that same line (claim-drift-engine tokenize or equivalent).
 * Empty / whitespace-only lines never hit.
 */
export function findCopyDependentHits(
  line: string,
  tokens: { kind: string; text: string }[],
): CopyDependentHit[] {
  if (line.trim().length === 0) return [];
  const words = wordTexts(tokens);
  if (words.length === 0) return [];
  const hits: CopyDependentHit[] = [];
  for (const hold of activeCopyDependentHolds()) {
    if (!runDetector(hold.detector, words)) continue;
    hits.push({
      holdId: hold.id,
      title: hold.title,
      why: hold.why,
      publicTracker: hold.publicTracker,
    });
  }
  return hits;
}
