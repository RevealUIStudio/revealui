/**
 * low_trust_review preset resolution (Spec 03, OSS / free tier).
 *
 * Server-side only. The narrowest preset wins: any low_trust_review layer
 * beats standard. A low_trust_review result must bind to exactly one concrete
 * ReviewScope in the run account. Missing, ambiguous, and cross-account scopes
 * fail closed. Client layers may narrow the preset and cannot supply scope.
 */

export const TRUST_PRESETS = ['standard', 'low_trust_review'] as const;
export type TrustPreset = (typeof TRUST_PRESETS)[number];

export const REVIEW_SCOPE_KINDS = ['ticket', 'pull_request', 'document', 'email_thread'] as const;
export type ReviewScopeKind = (typeof REVIEW_SCOPE_KINDS)[number];

export interface ReviewScope {
  kind: ReviewScopeKind;
  /** Ticket id, "owner/repo#number", document id, or thread id. */
  id: string;
  accountId: string;
}

export const TRUST_SOURCES = ['agent', 'project', 'task'] as const;
export type TrustSource = (typeof TRUST_SOURCES)[number];

export interface ResolvedTrust {
  preset: TrustPreset;
  /** Required when preset is low_trust_review. Null for standard. */
  scope: ReviewScope | null;
  sources: TrustSource[];
}

/** Classes the preset denies absolutely. Exec and admin-pii stay denied in shadow mode. */
export const LOW_TRUST_DENIED_CLASSES = ['exec', 'admin-pii', 'network', 'memory-write'] as const;
export type LowTrustDeniedClass = (typeof LOW_TRUST_DENIED_CLASSES)[number];

/** Channels that default to low_trust_review once the flag is enforce. */
export const EXTERNAL_TRUST_CHANNEL_SOURCES = ['public_form', 'inbound_email', 'fork_pr'] as const;
export type ExternalTrustChannel = (typeof EXTERNAL_TRUST_CHANNEL_SOURCES)[number];

export const LOW_TRUST_MODES = ['off', 'shadow', 'enforce'] as const;
export type LowTrustMode = (typeof LOW_TRUST_MODES)[number];

export const DEFAULT_LOW_TRUST_MAX_OUTPUT_BYTES = 8192;

export interface LowTrustLimitsConfig {
  /** Max bytes of a scoped low-trust output (default: 8192). */
  maxOutputBytes: number;
  /** Max characters of a review scope id (default: 512). */
  maxScopeIdLength: number;
}

const DEFAULT_LIMITS: LowTrustLimitsConfig = {
  maxOutputBytes: DEFAULT_LOW_TRUST_MAX_OUTPUT_BYTES,
  maxScopeIdLength: 512,
};

let limits: LowTrustLimitsConfig = { ...DEFAULT_LIMITS };

export function configureLowTrustLimits(overrides: Partial<LowTrustLimitsConfig>): void {
  const next: LowTrustLimitsConfig = { ...limits, ...overrides };
  if (!Number.isInteger(next.maxOutputBytes) || next.maxOutputBytes < 1) {
    throw new Error('configureLowTrustLimits: maxOutputBytes must be a positive integer');
  }
  if (!Number.isInteger(next.maxScopeIdLength) || next.maxScopeIdLength < 1) {
    throw new Error('configureLowTrustLimits: maxScopeIdLength must be a positive integer');
  }
  limits = next;
}

export function getLowTrustLimits(): LowTrustLimitsConfig {
  return { ...limits };
}

export function resetLowTrustLimits(): void {
  limits = { ...DEFAULT_LIMITS };
}

/**
 * `off` when unset. Unknown non-empty values resolve to `enforce` so a typo
 * cannot disable containment.
 */
export function parseLowTrustMode(value: string | undefined | null): LowTrustMode {
  if (value === undefined || value === null || value === '') return 'off';
  if (value === 'off' || value === 'shadow' || value === 'enforce') return value;
  return 'enforce';
}

export function isExternalTrustChannel(source: string): boolean {
  return (EXTERNAL_TRUST_CHANNEL_SOURCES as readonly string[]).includes(source);
}

export interface TrustLayerScopeInput {
  kind: string;
  id: string;
  accountId: string;
}

/**
 * One assignment layer. `origin` defaults to `server`. Client layers may only
 * contribute a `low_trust_review` preset. Their scope is ignored.
 */
export interface TrustLayer {
  source: string;
  preset?: string | null;
  scope?: TrustLayerScopeInput | null;
  origin?: 'server' | 'client';
}

export type TrustResolveFailureReason =
  | 'missing_scope'
  | 'ambiguous_scope'
  | 'cross_account_scope'
  | 'invalid_layer';

export interface TrustResolveSuccess {
  ok: true;
  trust: ResolvedTrust;
}

export interface TrustResolveFailure {
  ok: false;
  reason: TrustResolveFailureReason;
  sources: TrustSource[];
}

export type TrustResolveResult = TrustResolveSuccess | TrustResolveFailure;

export interface ResolveTrustOptions {
  /** Account the run belongs to. Low-trust scopes must match it exactly. */
  accountId: string;
}

const PRESET_SET: ReadonlySet<string> = new Set(TRUST_PRESETS);
const KIND_SET: ReadonlySet<string> = new Set(REVIEW_SCOPE_KINDS);
const SOURCE_SET: ReadonlySet<string> = new Set(TRUST_SOURCES);

function isTrustSource(value: string): value is TrustSource {
  return SOURCE_SET.has(value);
}

function isTrustPreset(value: string): value is TrustPreset {
  return PRESET_SET.has(value);
}

function isReviewScopeKind(value: string): value is ReviewScopeKind {
  return KIND_SET.has(value);
}

function rememberSource(sources: TrustSource[], source: TrustSource): void {
  if (!sources.includes(source)) sources.push(source);
}

interface ParsedLayer {
  source: TrustSource;
  preset: TrustPreset | null;
  scope: ReviewScope | null;
  origin: 'server' | 'client';
}

function parseLayer(
  layer: TrustLayer,
  sources: TrustSource[],
): { ok: true; layer: ParsedLayer | null } | { ok: false; reason: 'invalid_layer' } {
  if (!isTrustSource(layer.source)) {
    return { ok: false, reason: 'invalid_layer' };
  }
  const origin = layer.origin ?? 'server';
  if (origin !== 'server' && origin !== 'client') {
    return { ok: false, reason: 'invalid_layer' };
  }

  let preset: TrustPreset | null = null;
  if (layer.preset != null && layer.preset !== '') {
    if (!isTrustPreset(layer.preset)) {
      rememberSource(sources, layer.source);
      return { ok: false, reason: 'invalid_layer' };
    }
    preset = layer.preset;
  }

  // A client may only narrow. Standard (or absent) is not a decision.
  if (origin === 'client' && preset !== 'low_trust_review') {
    return { ok: true, layer: null };
  }

  if (preset !== null) rememberSource(sources, layer.source);

  let scope: ReviewScope | null = null;
  if (origin === 'server' && layer.scope != null) {
    const raw = layer.scope;
    if (!isReviewScopeKind(raw.kind)) {
      return { ok: false, reason: 'invalid_layer' };
    }
    const maxId = getLowTrustLimits().maxScopeIdLength;
    const idConcrete = raw.id.length > 0 && raw.id.length <= maxId && raw.id === raw.id.trim();
    const accountConcrete =
      raw.accountId.length > 0 &&
      raw.accountId.length <= maxId &&
      raw.accountId === raw.accountId.trim();
    if (idConcrete && accountConcrete) {
      scope = { kind: raw.kind, id: raw.id, accountId: raw.accountId };
    }
  }

  return {
    ok: true,
    layer: { source: layer.source, preset, scope, origin },
  };
}

function sameScope(left: ReviewScope, right: ReviewScope): boolean {
  return left.kind === right.kind && left.id === right.id && left.accountId === right.accountId;
}

/**
 * Resolve layered trust assignments. Fails closed for low_trust_review when
 * the scope is missing, ambiguous, or belongs to another account.
 */
export function resolveTrust(
  layers: readonly TrustLayer[],
  options: ResolveTrustOptions,
): TrustResolveResult {
  const sources: TrustSource[] = [];
  const parsed: ParsedLayer[] = [];

  for (const layer of layers) {
    const result = parseLayer(layer, sources);
    if (!result.ok) {
      return { ok: false, reason: result.reason, sources };
    }
    if (result.layer) parsed.push(result.layer);
  }

  const narrowed = parsed.some((layer) => layer.preset === 'low_trust_review');
  if (!narrowed) {
    return {
      ok: true,
      trust: { preset: 'standard', scope: null, sources },
    };
  }

  const serverScopes: ReviewScope[] = [];
  for (const layer of parsed) {
    if (layer.origin !== 'server' || layer.scope === null) continue;
    const already = serverScopes.some((existing) =>
      sameScope(existing, layer.scope as ReviewScope),
    );
    if (!already) serverScopes.push(layer.scope);
  }

  const runAccount = options.accountId;
  const runAccountConcrete = runAccount.length > 0 && runAccount === runAccount.trim();
  if (!runAccountConcrete || serverScopes.some((scope) => scope.accountId !== runAccount)) {
    return { ok: false, reason: 'cross_account_scope', sources };
  }

  const distinct = new Map<string, ReviewScope>();
  for (const scope of serverScopes) {
    distinct.set(`${scope.kind}\u0000${scope.id}`, scope);
  }
  if (distinct.size === 0) {
    return { ok: false, reason: 'missing_scope', sources };
  }
  if (distinct.size > 1) {
    return { ok: false, reason: 'ambiguous_scope', sources };
  }

  const scope = distinct.values().next().value;
  if (!scope) {
    return { ok: false, reason: 'missing_scope', sources };
  }

  return {
    ok: true,
    trust: { preset: 'low_trust_review', scope, sources },
  };
}
