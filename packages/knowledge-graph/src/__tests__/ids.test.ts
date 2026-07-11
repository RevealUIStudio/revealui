import { describe, expect, it } from 'vitest';
import {
  deriveEdgeId,
  deriveEpisodeId,
  deriveNodeId,
  deterministicUuid,
  stableStringify,
} from '../ids.js';

const UUID_LENGTH = 36;

describe('deterministicUuid', () => {
  it('is deterministic and canonically shaped (v5, RFC-4122 variant)', () => {
    const a = deterministicUuid('hello');
    const b = deterministicUuid('hello');
    expect(a).toBe(b);
    expect(a).toHaveLength(UUID_LENGTH);
    expect(a[14]).toBe('5'); // version nibble
    expect(['8', '9', 'a', 'b']).toContain(a[19]); // variant nibble
  });

  it('separates distinct inputs', () => {
    expect(deterministicUuid('a')).not.toBe(deterministicUuid('b'));
  });
});

describe('deriveNodeId', () => {
  it('is stable and kind-sensitive', () => {
    const key = 'revealui/packages/ai/src/llm/client.ts#getClient';
    expect(deriveNodeId('symbol', key)).toBe(deriveNodeId('symbol', key));
    expect(deriveNodeId('symbol', key)).not.toBe(deriveNodeId('file', key));
  });
});

describe('deriveEdgeId', () => {
  it('depends on valid time so re-appearance is a new edge', () => {
    const s = deriveNodeId('package', 'revealui:pkg:@revealui/ai');
    const t = deriveNodeId('dependency', 'npm:zod');
    const t1 = new Date('2026-01-01T00:00:00Z');
    const t2 = new Date('2026-02-01T00:00:00Z');
    expect(deriveEdgeId(s, t, 'depends-on', t1)).toBe(deriveEdgeId(s, t, 'depends-on', t1));
    expect(deriveEdgeId(s, t, 'depends-on', t1)).not.toBe(deriveEdgeId(s, t, 'depends-on', t2));
  });
});

describe('deriveEpisodeId', () => {
  it('is content-addressed and independent of contentRef key order', () => {
    const referenceTime = new Date('2026-07-11T00:00:00Z');
    const a = deriveEpisodeId({
      episodeType: 'code-scan',
      source: 'revealui:workspace',
      contentRef: { repo: 'revealui', extractor: 'workspace' },
      referenceTime,
    });
    const b = deriveEpisodeId({
      episodeType: 'code-scan',
      source: 'revealui:workspace',
      contentRef: { extractor: 'workspace', repo: 'revealui' },
      referenceTime,
    });
    expect(a).toBe(b);
  });
});

describe('stableStringify', () => {
  it('sorts keys and drops undefined', () => {
    expect(stableStringify({ b: 1, a: 2, c: undefined })).toBe('{"a":2,"b":1}');
  });
});
