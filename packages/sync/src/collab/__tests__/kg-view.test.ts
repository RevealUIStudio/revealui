/**
 * Knowledge graph curation overlay (design spec §8.3). Round-trips
 * `buildAnnotationPatch`/`buildPinPatch`/`buildLayoutPatch`/`buildPresencePatch`
 * through the REAL `applyPatch` + `readScratchpad` Yjs machinery (not just
 * unit-testing `parseKgViewState` against fabricated objects) — this is the
 * "verify the existing structured-patch REST path works for these docs"
 * requirement from the P4 checklist.
 */

import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import {
  buildAnnotationPatch,
  buildKgViewDocumentId,
  buildLayoutPatch,
  buildPinPatch,
  buildPresencePatch,
  isKgViewDocumentId,
  isPresenceStale,
  isValidKgViewSlug,
  KG_VIEW_ID_PREFIX,
  PRESENCE_STALE_MS,
  parseKgViewState,
} from '../kg-view.js';
import {
  applyPatch,
  applyPatches,
  readScratchpad,
  type ScratchpadPatch,
} from '../scratchpad-patch-applier.js';

describe('isValidKgViewSlug', () => {
  it('accepts lowercase alphanumeric and hyphens', () => {
    expect(isValidKgViewSlug('electric-sync-map')).toBe(true);
    expect(isValidKgViewSlug('view1')).toBe(true);
  });

  it('rejects the empty string, uppercase, and non-charset characters', () => {
    expect(isValidKgViewSlug('')).toBe(false);
    expect(isValidKgViewSlug('View')).toBe(false);
    expect(isValidKgViewSlug('view_1')).toBe(false);
    expect(isValidKgViewSlug('view/1')).toBe(false);
    expect(isValidKgViewSlug("view'; DROP TABLE--")).toBe(false);
  });

  it('rejects slugs over the length bound', () => {
    expect(isValidKgViewSlug('a'.repeat(64))).toBe(true);
    expect(isValidKgViewSlug('a'.repeat(65))).toBe(false);
  });
});

describe('buildKgViewDocumentId / isKgViewDocumentId', () => {
  it('builds a prefixed document id from a valid slug', () => {
    expect(buildKgViewDocumentId('my-view')).toBe(`${KG_VIEW_ID_PREFIX}my-view`);
  });

  it('throws on an invalid slug', () => {
    expect(() => buildKgViewDocumentId('My View')).toThrow();
  });

  it('round-trips through isKgViewDocumentId', () => {
    const id = buildKgViewDocumentId('my-view');
    expect(isKgViewDocumentId(id)).toBe(true);
    expect(isKgViewDocumentId('0b9f2a4e-1c3d-4e5f-8a7b-9c0d1e2f3a4b')).toBe(false);
    expect(isKgViewDocumentId('kg-view-')).toBe(false);
  });

  it('is compatible with the existing yjs-document-patches DOCUMENT_ID_RE charset', () => {
    // apps/admin/.../api/sync/yjs-document-patches/route.ts: /^[a-zA-Z0-9_-]+$/
    const allowedChars = new Set(
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-',
    );
    const id = buildKgViewDocumentId('electric-sync-map');
    expect(Array.from(id).every((c) => allowedChars.has(c))).toBe(true);
  });
});

describe('kg-view patch round trip through real Yjs', () => {
  const nodeId = '0b9f2a4e-1c3d-4e5f-8a7b-9c0d1e2f3a4b';

  it('annotate then read back via readScratchpad + parseKgViewState', () => {
    const now = new Date('2026-07-11T12:00:00Z');
    const patch = buildAnnotationPatch(
      nodeId,
      'looks stale, verify against code',
      'claude-session',
      now,
    );
    const { state } = applyPatches(null, [patch]);
    const root = readScratchpad(state);
    const parsed = parseKgViewState(root);

    const annotation = parsed.annotations.get(nodeId);
    expect(annotation?.text).toBe('looks stale, verify against code');
    expect(annotation?.authorAgentId).toBe('claude-session');
    expect(annotation?.updatedAt).toBe(now.toISOString());
  });

  it('pin then unpin, applying patches sequentially to the same doc', () => {
    const doc = new Y.Doc();
    applyPatch(doc, buildPinPatch(nodeId, true));
    let parsed = parseKgViewState(readScratchpad(Y.encodeStateAsUpdate(doc)));
    expect(parsed.pins.has(nodeId)).toBe(true);

    applyPatch(doc, buildPinPatch(nodeId, false));
    parsed = parseKgViewState(readScratchpad(Y.encodeStateAsUpdate(doc)));
    expect(parsed.pins.has(nodeId)).toBe(false);
    doc.destroy();
  });

  it('sets a layout position', () => {
    const patch = buildLayoutPatch(nodeId, 120, -40);
    const { state } = applyPatches(null, [patch]);
    const parsed = parseKgViewState(readScratchpad(state));
    expect(parsed.layout.get(nodeId)).toEqual({ x: 120, y: -40 });
  });

  it('records a presence heartbeat', () => {
    const now = new Date('2026-07-11T12:00:00Z');
    const patch = buildPresencePatch('client-abc', 'Joshua', nodeId, now);
    const { state } = applyPatches(null, [patch]);
    const parsed = parseKgViewState(readScratchpad(state));
    expect(parsed.presence.get('client-abc')).toEqual({
      name: 'Joshua',
      nodeId,
      updatedAt: now.toISOString(),
    });
  });

  it('applies multiple overlay kinds together and reads them all back', () => {
    const patches: ScratchpadPatch[] = [
      buildAnnotationPatch(nodeId, 'note', 'agent-a'),
      buildPinPatch(nodeId, true),
      buildLayoutPatch(nodeId, 1, 2),
      buildPresencePatch('client-1', 'Agent A', nodeId),
    ];
    const { state } = applyPatches(null, patches);
    const parsed = parseKgViewState(readScratchpad(state));

    expect(parsed.annotations.has(nodeId)).toBe(true);
    expect(parsed.pins.has(nodeId)).toBe(true);
    expect(parsed.layout.has(nodeId)).toBe(true);
    expect(parsed.presence.has('client-1')).toBe(true);
  });

  it('drops malformed entries instead of throwing', () => {
    const parsed = parseKgViewState({
      'annotation:n1': 'not json',
      'layout:n2': JSON.stringify({ x: 'nope', y: 2 }),
      'pin:n3': 'yes', // not literally 'true'
      'presence:c1': JSON.stringify({ name: 42 }),
      unrelated_key: 'ignored',
    });
    expect(parsed.annotations.size).toBe(0);
    expect(parsed.layout.size).toBe(0);
    expect(parsed.pins.has('n3')).toBe(false);
    expect(parsed.presence.size).toBe(0);
  });
});

describe('isPresenceStale', () => {
  it('is not stale just under the threshold', () => {
    const now = new Date('2026-07-11T12:00:00Z');
    const entry = {
      name: 'a',
      nodeId: null,
      updatedAt: new Date(now.getTime() - (PRESENCE_STALE_MS - 1000)).toISOString(),
    };
    expect(isPresenceStale(entry, now)).toBe(false);
  });

  it('is stale past the threshold', () => {
    const now = new Date('2026-07-11T12:00:00Z');
    const entry = {
      name: 'a',
      nodeId: null,
      updatedAt: new Date(now.getTime() - (PRESENCE_STALE_MS + 1000)).toISOString(),
    };
    expect(isPresenceStale(entry, now)).toBe(true);
  });

  it('treats an unparseable timestamp as stale', () => {
    expect(isPresenceStale({ name: 'a', nodeId: null, updatedAt: 'not-a-date' })).toBe(true);
  });
});
