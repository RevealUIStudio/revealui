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
  | 'saml-live'
  | 'cscrm-certified'
  | 'trustworthy-ai-badge'
  | 'aml-hardened'
  | 'weight-scan';

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
    status: 'waiting',
    title: 'Enterprise SSO / SAML customer copy',
    detector: 'sso-live',
    why: 'OIDC+SAML schema, routes, and Admin exist on test, but customer-facing live claims stay forbidden until #449 closes (no customer IdP walk)',
    publicTracker: '#449',
  },
  {
    id: 'COPY-DEP-ENTERPRISE-SAML',
    status: 'waiting',
    title: 'Enterprise SAML live claims',
    detector: 'saml-live',
    why: 'SAML SP path exists on test, but customer-facing live claims stay forbidden until #449 closes; SCIM is not built',
    publicTracker: '#449',
  },
  {
    id: 'COPY-DEP-VISUAL-BUILDER',
    status: 'waiting',
    title: 'Visual Builder product copy',
    detector: 'visual-builder-live',
    why: 'Visual Editing is Planned; no live drag-and-drop builder claim',
    publicTracker: '#1816',
  },
  {
    id: 'COPY-DEP-FLEET-DOCKER-IMAGES',
    status: 'waiting',
    title: 'Self-hosted Docker / GHCR Fleet kit copy',
    detector: 'ghcr-fleet-images-live',
    why: 'CI pushes GHCR tags; do not claim a launched customer pull-and-run Fleet kit is live',
  },
  {
    id: 'COPY-DEP-C-SCRM-CERT',
    status: 'waiting',
    title: 'C-SCRM / NIST SP 800-161 certification copy',
    detector: 'cscrm-certified',
    why: 'No C-SCRM or NIST SP 800-161 product badge. npm/CI hardening is a different class (GAP-484)',
  },
  {
    id: 'COPY-DEP-AML-HARDENED',
    status: 'waiting',
    title: 'Adversarial-ML / poisoning-resistant copy',
    detector: 'aml-hardened',
    why: 'NIST AI 100-2: no information-theoretic AML guarantees; do not claim hardened or poisoning-resistant (GAP-484)',
  },
  {
    id: 'COPY-DEP-TRUSTWORTHY-AI',
    status: 'waiting',
    title: 'Trustworthy AI product-badge copy',
    detector: 'trustworthy-ai-badge',
    why: 'NIST trustworthiness attributes are a framework with tradeoffs, not a RevealUI badge (GAP-484)',
  },
  {
    id: 'COPY-DEP-MODEL-PROVENANCE',
    status: 'waiting',
    title: 'Model-weight scan copy',
    detector: 'weight-scan',
    why: 'Weights are not scanned for behavior. Provenance is hash plus URL, not a capability scan (GAP-484)',
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

function hasWordSequence(words: string[], seq: readonly string[]): boolean {
  if (seq.length === 0) return false;
  for (let i = 0; i <= words.length - seq.length; i++) {
    let ok = true;
    for (let k = 0; k < seq.length; k++) {
      if (words[i + k] !== seq[k]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

/**
 * Same-line honesty qualifiers for SSO/SAML. A tracker alone (#449) does not
 * bless buyer-facing "in code" / what-you-get claims while the issue is open.
 */
function hasSsoRoadmapQualifier(words: string[]): boolean {
  if (words.includes('preview')) return true;
  if (words.includes('planned')) return true;
  if (words.includes('roadmap')) return true;
  if (words.includes('forthcoming')) return true;
  if (hasWordSequence(words, ['coming', 'soon'])) return true;
  if (hasWordSequence(words, ['not', 'customer', 'walked'])) return true;
  if (hasWordSequence(words, ['does', 'not', 'work'])) return true;
  if (hasWordSequence(words, ['doesn', 't', 'work'])) return true;
  return false;
}

/** Residual operator honesty: code exists, customer walk / SCIM do not. */
function hasSsoResidualHonesty(words: string[]): boolean {
  if (hasWordSequence(words, ['does', 'not', 'work'])) return true;
  if (hasWordSequence(words, ['doesn', 't', 'work'])) return true;
  for (let i = 0; i < words.length; i++) {
    if (words[i] !== 'scim') continue;
    if (hasNearby(words, i, 8, new Set(['not'])) && hasNearby(words, i, 8, new Set(['built']))) {
      return true;
    }
  }
  return false;
}

function hasInCodeClaim(words: string[], from: number, window: number): boolean {
  const hi = Math.min(words.length, from + window);
  for (let j = from; j < hi; j++) {
    if (words[j] === 'in' && words[j + 1] === 'code') return true;
  }
  return false;
}

/** Pricing / "what you get" table row: leading pipe plus a `$` price cell. */
function isPricingWhatYouGetRow(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|')) return false;
  return line.includes('$');
}

function ssoAnchorLen(words: string[], i: number): number {
  if (words[i] === 'sso') return 1;
  if (words[i] === 'single' && words[i + 1] === 'sign' && words[i + 2] === 'on') return 3;
  return 0;
}

/** "SSO is available/live" or "SSO is in code" — not bare "SSO" glossary. */
function detectSsoLive(words: string[], line: string): boolean {
  if (hasSsoRoadmapQualifier(words) || hasSsoResidualHonesty(words)) return false;
  let sawSso = false;
  for (let i = 0; i < words.length; i++) {
    const len = ssoAnchorLen(words, i);
    if (len === 0) continue;
    sawSso = true;
    if (hasLiveCopula(words, i + len, 12)) return true;
    if (hasInCodeClaim(words, i + len, 12)) return true;
  }
  return sawSso && isPricingWhatYouGetRow(line);
}

function detectSamlLive(words: string[], line: string): boolean {
  if (hasSsoRoadmapQualifier(words) || hasSsoResidualHonesty(words)) return false;
  let sawSaml = false;
  for (let i = 0; i < words.length; i++) {
    if (words[i] !== 'saml') continue;
    sawSaml = true;
    if (hasLiveCopula(words, i + 1, 12)) return true;
    if (hasInCodeClaim(words, i + 1, 12)) return true;
  }
  return sawSaml && isPricingWhatYouGetRow(line);
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

const CERT_WORDS = new Set(['certified', 'compliant', 'aligned', 'assured', 'badge', 'standard']);

const WEIGHT_WORDS = new Set(['weights', 'weight']);

function hasNearby(words: string[], from: number, window: number, needles: Set<string>): boolean {
  const lo = Math.max(0, from - window);
  const hi = Math.min(words.length, from + window);
  for (let j = lo; j < hi; j++) {
    if (needles.has(words[j] ?? '')) return true;
  }
  return false;
}

/** "C-SCRM certified" / "NIST 800-161 compliant" — not a glossary mention. */
function detectCscrmCertified(words: string[]): boolean {
  for (let i = 0; i < words.length; i++) {
    if (words[i] === 'c' && words[i + 1] === 'scrm') {
      if (hasNearby(words, i, 8, CERT_WORDS)) return true;
    }
    if (words[i] === 'cscrm' && hasNearby(words, i, 8, CERT_WORDS)) return true;
    if (
      words[i] === 'nist' &&
      words[i + 1] === '800' &&
      words[i + 2] === '161' &&
      hasNearby(words, i, 8, CERT_WORDS)
    ) {
      return true;
    }
    if (
      words[i] === 'sp' &&
      words[i + 1] === '800' &&
      words[i + 2] === '161' &&
      hasNearby(words, i, 8, CERT_WORDS)
    ) {
      return true;
    }
    if (
      words[i] === 'supply' &&
      words[i + 1] === 'chain' &&
      (words[i + 2] === 'assured' || words[i + 2] === 'certified' || words[i + 2] === 'compliant')
    ) {
      return true;
    }
  }
  return false;
}

/** "trustworthy AI certified" / "our trustworthy AI" as a product badge. */
function detectTrustworthyAiBadge(words: string[]): boolean {
  for (let i = 0; i < words.length; i++) {
    if (words[i] !== 'trustworthy' || words[i + 1] !== 'ai') continue;
    if (hasNearby(words, i, 6, CERT_WORDS)) return true;
    if (i > 0 && (words[i - 1] === 'our' || words[i - 1] === 'revealui')) return true;
  }
  return false;
}

function detectAmlHardened(words: string[]): boolean {
  for (let i = 0; i < words.length; i++) {
    if (words[i] === 'adversarially' && words[i + 1] === 'robust') return true;
    if (words[i] === 'aml' && words[i + 1] === 'hardened') return true;
    if (words[i] === 'poisoning' && words[i + 1] === 'resistant') return true;
    if (
      words[i] === 'prompt' &&
      words[i + 1] === 'injection' &&
      (words[i + 2] === 'proof' || words[i + 2] === 'proofed')
    ) {
      return true;
    }
  }
  return false;
}

/** "we scan model weights" / "scanned weights" as a capability claim. */
function detectWeightScan(words: string[]): boolean {
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w !== 'scan' && w !== 'scans' && w !== 'scanned' && w !== 'sanitize' && w !== 'sanitized') {
      continue;
    }
    if (hasNearby(words, i, 6, WEIGHT_WORDS)) return true;
  }
  return false;
}

function runDetector(detector: CopyDependentDetector, words: string[], line: string): boolean {
  switch (detector) {
    case 'marketplace-live':
      return detectMarketplaceLive(words);
    case 'x402-live':
      return detectX402Live(words);
    case 'sso-live':
      return detectSsoLive(words, line);
    case 'saml-live':
      return detectSamlLive(words, line);
    case 'visual-builder-live':
      return detectVisualBuilderLive(words);
    case 'ghcr-fleet-images-live':
      return detectGhcrFleetImagesLive(words);
    case 'cscrm-certified':
      return detectCscrmCertified(words);
    case 'trustworthy-ai-badge':
      return detectTrustworthyAiBadge(words);
    case 'aml-hardened':
      return detectAmlHardened(words);
    case 'weight-scan':
      return detectWeightScan(words);
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
    if (!runDetector(hold.detector, words, line)) continue;
    hits.push({
      holdId: hold.id,
      title: hold.title,
      why: hold.why,
      publicTracker: hold.publicTracker,
    });
  }
  return hits;
}
