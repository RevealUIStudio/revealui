import { describe, expect, it } from 'vitest';
import { assembleContext } from '../inference/context-assembly.js';
import type { RagSearchResult } from '../ingestion/rag-vector-service.js';

function makeResult(
  id: string,
  content: string,
  similarity: number,
  createdAt: Date = new Date(),
): RagSearchResult {
  return {
    chunk: {
      id,
      documentId: `doc-${id}`,
      workspaceId: 'ws-1',
      content,
      tokenCount: Math.ceil(content.length / 4),
      chunkIndex: 0,
      embedding: null,
      embeddingModel: 'nomic-embed-text',
      metadata: {},
      createdAt,
    },
    document: {
      id: `doc-${id}`,
      title: `Document ${id}`,
      sourceType: 'text',
      sourceCollection: null,
      sourceId: null,
      createdAt,
    },
    similarity,
  };
}

describe('assembleContext', () => {
  it('returns empty string for no results', () => {
    expect(assembleContext([], { maxTokens: 2000 })).toBe('');
  });

  it('formats context with numbered references', () => {
    const results = [makeResult('a', 'First chunk content', 0.9)];
    const ctx = assembleContext(results, { maxTokens: 2000 });
    expect(ctx).toContain('[1]');
    expect(ctx).toContain('Source: Document a');
    expect(ctx).toContain('First chunk content');
  });

  it('respects maxTokens budget', () => {
    const results = Array.from({ length: 20 }, (_, i) =>
      makeResult(`chunk-${i}`, 'word '.repeat(200), 0.8),
    );
    const ctx = assembleContext(results, { maxTokens: 500 });
    const tokens = Math.ceil(ctx.length / 4);
    expect(tokens).toBeLessThanOrEqual(550); // small tolerance
  });

  it('prefers higher similarity results', () => {
    const now = new Date();
    const results = [
      makeResult('low', 'low relevance content', 0.5, now),
      makeResult('high', 'high relevance content', 0.95, now),
    ];
    const ctx = assembleContext(results, {
      maxTokens: 2000,
      relevanceWeight: 1.0,
      recencyWeight: 0.0,
    });
    const highIdx = ctx.indexOf('high relevance');
    const lowIdx = ctx.indexOf('low relevance');
    // Higher similarity should appear first (lower numbered reference)
    expect(highIdx).toBeLessThan(lowIdx);
  });

  it('prefers newer chunks with high recency weight', () => {
    const old = new Date('2024-01-01');
    const recent = new Date('2026-01-01');
    const results = [
      makeResult('old', 'old content', 0.7, old),
      makeResult('new', 'new content', 0.7, recent),
    ];
    const ctx = assembleContext(results, {
      maxTokens: 2000,
      relevanceWeight: 0.0,
      recencyWeight: 1.0,
    });
    const newIdx = ctx.indexOf('new content');
    const oldIdx = ctx.indexOf('old content');
    expect(newIdx).toBeLessThan(oldIdx);
  });

  it('truncates single oversized chunks with [content truncated]', () => {
    const bigContent = 'word '.repeat(5000); // very large
    const results = [makeResult('big', bigContent, 0.9)];
    const ctx = assembleContext(results, { maxTokens: 100 });
    expect(ctx).toContain('[content truncated]');
  });

  it('separates multiple chunks with divider', () => {
    const results = [makeResult('a', 'Content A', 0.9), makeResult('b', 'Content B', 0.8)];
    const ctx = assembleContext(results, { maxTokens: 2000 });
    expect(ctx).toContain('---');
    expect(ctx).toContain('Content A');
    expect(ctx).toContain('Content B');
  });
});
