/**
 * Knowledge graph curation overlay — per-view Y.Doc shape (design spec §8.3).
 *
 * Extends the EXISTING `yjs_documents` + `yjs_document_patches` infra (never
 * a new table): a "graph view" document is keyed `kg-view-<slug>` and holds
 * three kinds of ephemeral overlay state on top of the canonical graph —
 * annotations, pins, and layout positions — plus a small polled presence
 * overlay (see below). The Yjs state is NEVER written into `kg_*` tables
 * directly; the only bridge is the explicit "flush to episode" action
 * (`POST /api/sync/kg-episodes`), which reads selected annotations out of
 * this shape and durably records them as a `manual` episode via
 * `ingestEpisode`. Boundary rule, verbatim from the spec: "Yjs co-edits
 * ephemeral working state; the Postgres CRDT classes hold canonical truth;
 * episodes are the only bridge between them."
 *
 * ## Document id
 *
 * `kg-view-<slug>` (hyphen, not the spec's illustrative `kg-view:<slug>` —
 * see the PR body escalation: the existing `/api/sync/yjs-document-patches`
 * write route's `DOCUMENT_ID_RE` already accepts `[a-zA-Z0-9_-]+`, so a
 * hyphen-delimited id reuses that route UNCHANGED; a colon would not have
 * matched it). Validate the slug with {@link isValidKgViewSlug} before
 * building an id with {@link buildKgViewDocumentId}.
 *
 * ## Patch shapes (structured-patch REST path, Layer 2 of multi-agent-memory)
 *
 * All four overlay kinds ride the EXISTING `set_key` patch type — root-level
 * key set to a string value (`packages/sync/src/collab/scratchpad-patch-applier.ts`).
 * No new patch type was added; each kind is a distinct root-key PREFIX with a
 * JSON- or boolean-encoded string value:
 *
 * | Kind        | Root key                | Content                                    |
 * |-------------|--------------------------|---------------------------------------------|
 * | annotation  | `annotation:<nodeId>`    | `JSON.stringify(KgViewAnnotation)`           |
 * | pin         | `pin:<nodeId>`           | `'true'` or `'false'`                        |
 * | layout      | `layout:<nodeId>`        | `JSON.stringify(KgViewLayoutPosition)`       |
 * | presence    | `presence:<clientId>`    | `JSON.stringify(KgViewPresenceEntry)`        |
 *
 * `nodeId` is a `kg_nodes.id` (deterministic UUID-shaped id — already a safe
 * character set). `clientId` is a per-tab `crypto.randomUUID()`. Both CLI
 * agents (via `POST /api/sync/yjs-document-patches`, unmodified) and browser
 * agents (via the same REST path today; a live websocket path is deferred —
 * see `use-kg-view-document.ts`) write through this exact shape.
 *
 * ## Presence (awareness deferred)
 *
 * `apps/admin` has no live Yjs websocket wired (`useCollaboration` /
 * `CollabProvider` have zero admin consumers as of GAP-349 P4). Rather than
 * standing up a new websocket server, presence is a small POLLED overlay:
 * viewers periodically POST a `presence:<clientId>` patch (a heartbeat); the
 * READ side is still fully live via the Electric shape subscription (any
 * patch from any agent propagates to every subscriber in real time), so
 * presence freshness is bounded by the write-side poll interval, not the
 * read side. A stale entry (older than {@link PRESENCE_STALE_MS}) is treated
 * as gone by {@link isPresenceStale} — there is no delete patch type, so
 * presence rows are never removed, only aged out client-side.
 */

import type { ScratchpadPatch } from './scratchpad-patch-applier.js';

export const KG_VIEW_ID_PREFIX = 'kg-view-';

const SLUG_CHARS = new Set('abcdefghijklmnopqrstuvwxyz0123456789-');
const MAX_SLUG_LENGTH = 64;

const ANNOTATION_PREFIX = 'annotation:';
const PIN_PREFIX = 'pin:';
const LAYOUT_PREFIX = 'layout:';
const PRESENCE_PREFIX = 'presence:';

/** Presence entries older than this are treated as stale (client-side only; never deleted server-side). */
export const PRESENCE_STALE_MS = 60_000;

/** Lowercase alphanumeric + hyphen, 1-64 chars. No authored regex — character-set check. */
export function isValidKgViewSlug(slug: string): boolean {
  return (
    slug.length > 0 &&
    slug.length <= MAX_SLUG_LENGTH &&
    Array.from(slug).every((c) => SLUG_CHARS.has(c))
  );
}

/** Build the `yjs_documents.id` for a validated view slug. Throws on an invalid slug. */
export function buildKgViewDocumentId(slug: string): string {
  if (!isValidKgViewSlug(slug)) {
    throw new Error(`invalid kg-view slug: ${slug}`);
  }
  return `${KG_VIEW_ID_PREFIX}${slug}`;
}

/** True when `documentId` is a well-formed kg-view document id. */
export function isKgViewDocumentId(documentId: string): boolean {
  if (!documentId.startsWith(KG_VIEW_ID_PREFIX)) return false;
  return isValidKgViewSlug(documentId.slice(KG_VIEW_ID_PREFIX.length));
}

export interface KgViewAnnotation {
  text: string;
  updatedAt: string;
  authorAgentId: string;
}

export interface KgViewLayoutPosition {
  x: number;
  y: number;
}

export interface KgViewPresenceEntry {
  name: string;
  nodeId: string | null;
  updatedAt: string;
}

export interface KgViewState {
  annotations: Map<string, KgViewAnnotation>;
  pins: Set<string>;
  layout: Map<string, KgViewLayoutPosition>;
  presence: Map<string, KgViewPresenceEntry>;
}

function emptyState(): KgViewState {
  return { annotations: new Map(), pins: new Set(), layout: new Map(), presence: new Map() };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseJsonString(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'string') return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function asAnnotation(raw: Record<string, unknown>): KgViewAnnotation | null {
  if (typeof raw.text !== 'string' || typeof raw.updatedAt !== 'string') return null;
  return {
    text: raw.text,
    updatedAt: raw.updatedAt,
    authorAgentId: typeof raw.authorAgentId === 'string' ? raw.authorAgentId : 'unknown',
  };
}

function asLayoutPosition(raw: Record<string, unknown>): KgViewLayoutPosition | null {
  if (typeof raw.x !== 'number' || typeof raw.y !== 'number') return null;
  return { x: raw.x, y: raw.y };
}

function asPresenceEntry(raw: Record<string, unknown>): KgViewPresenceEntry | null {
  if (typeof raw.name !== 'string' || typeof raw.updatedAt !== 'string') return null;
  return {
    name: raw.name,
    nodeId: typeof raw.nodeId === 'string' ? raw.nodeId : null,
    updatedAt: raw.updatedAt,
  };
}

/**
 * Parse the flat root map produced by `readScratchpad(state)` into the
 * typed kg-view overlay shape. Malformed entries (unparseable JSON, a
 * shape mismatch) are silently dropped rather than throwing — the overlay
 * is ephemeral working state, not a durable contract.
 */
export function parseKgViewState(root: Record<string, unknown>): KgViewState {
  const state = emptyState();

  for (const [key, value] of Object.entries(root)) {
    if (key.startsWith(ANNOTATION_PREFIX)) {
      const nodeId = key.slice(ANNOTATION_PREFIX.length);
      const raw = parseJsonString(value);
      const annotation = raw ? asAnnotation(raw) : null;
      if (annotation) state.annotations.set(nodeId, annotation);
      continue;
    }
    if (key.startsWith(PIN_PREFIX)) {
      const nodeId = key.slice(PIN_PREFIX.length);
      if (value === 'true') state.pins.add(nodeId);
      else state.pins.delete(nodeId);
      continue;
    }
    if (key.startsWith(LAYOUT_PREFIX)) {
      const nodeId = key.slice(LAYOUT_PREFIX.length);
      const raw = parseJsonString(value);
      const position = raw ? asLayoutPosition(raw) : null;
      if (position) state.layout.set(nodeId, position);
      continue;
    }
    if (key.startsWith(PRESENCE_PREFIX)) {
      const clientId = key.slice(PRESENCE_PREFIX.length);
      const raw = parseJsonString(value);
      const entry = raw ? asPresenceEntry(raw) : null;
      if (entry) state.presence.set(clientId, entry);
    }
  }

  return state;
}

/** True when a presence entry's `updatedAt` is older than {@link PRESENCE_STALE_MS}. */
export function isPresenceStale(entry: KgViewPresenceEntry, now: Date = new Date()): boolean {
  const updatedAt = Date.parse(entry.updatedAt);
  if (Number.isNaN(updatedAt)) return true;
  return now.getTime() - updatedAt > PRESENCE_STALE_MS;
}

export function buildAnnotationPatch(
  nodeId: string,
  text: string,
  authorAgentId: string,
  now: Date = new Date(),
): ScratchpadPatch {
  const annotation: KgViewAnnotation = { text, authorAgentId, updatedAt: now.toISOString() };
  return {
    patchType: 'set_key',
    path: `${ANNOTATION_PREFIX}${nodeId}`,
    content: JSON.stringify(annotation),
  };
}

export function buildPinPatch(nodeId: string, pinned: boolean): ScratchpadPatch {
  return {
    patchType: 'set_key',
    path: `${PIN_PREFIX}${nodeId}`,
    content: pinned ? 'true' : 'false',
  };
}

export function buildLayoutPatch(nodeId: string, x: number, y: number): ScratchpadPatch {
  const position: KgViewLayoutPosition = { x, y };
  return {
    patchType: 'set_key',
    path: `${LAYOUT_PREFIX}${nodeId}`,
    content: JSON.stringify(position),
  };
}

export function buildPresencePatch(
  clientId: string,
  name: string,
  nodeId: string | null,
  now: Date = new Date(),
): ScratchpadPatch {
  const entry: KgViewPresenceEntry = { name, nodeId, updatedAt: now.toISOString() };
  return {
    patchType: 'set_key',
    path: `${PRESENCE_PREFIX}${clientId}`,
    content: JSON.stringify(entry),
  };
}
