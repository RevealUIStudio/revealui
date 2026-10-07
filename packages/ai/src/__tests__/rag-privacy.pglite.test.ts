import type { Database } from '@revealui/db/client';
import { pages } from '@revealui/db/schema/pages';
import { ragChunks, ragDocuments } from '@revealui/db/schema/rag';
import { siteCollaborators, sites } from '@revealui/db/schema/sites';
import { users } from '@revealui/db/schema/users';
import { createTestDb, type TestDb } from '@revealui/db/testing';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AdminIndexer } from '../ingestion/admin-indexer.js';
import { hybridSearch } from '../ingestion/hybrid-search.js';
import { IngestionPipeline } from '../ingestion/pipeline.js';
import { RagVectorService } from '../ingestion/rag-vector-service.js';
import type { LLMClient } from '../llm/client.js';
import { createDocumentSummarizerTool } from '../tools/document-summarizer.js';

const vector = Array.from({ length: 768 }, (_, i) => (i === 0 ? 1 : 0));
let testDb: TestDb;
let db: Database;
let pipeline: IngestionPipeline;
let service: RagVectorService;
let documentId: string;
const search = (userId?: string, workspaceId = 'private') =>
  service.searchSimilar(vector, {
    workspaceId,
    userId,
    deploymentMode: 'hosted',
    threshold: 0,
  });

beforeAll(async () => {
  testDb = await createTestDb({ enableVector: true });
  db = testDb.drizzle as unknown as Database;
  pipeline = new IngestionPipeline(db, db, async () => vector);
  service = new RagVectorService(db);
  await db.insert(users).values(
    ['owner', 'viewer', 'editor', 'outsider', 'shell-admin'].map((id) => ({
      id,
      name: id,
      email: `${id}@example.test`,
      emailVerified: true,
      role: id === 'shell-admin' ? 'admin' : 'viewer',
    })),
  );
  await db.insert(sites).values([
    {
      id: 'private',
      ownerId: 'owner',
      name: 'Private',
      slug: 'private',
      status: 'published',
      visibility: 'private',
    },
    { id: 'other', ownerId: 'outsider', name: 'Other', slug: 'other', status: 'published' },
    { id: 'default', ownerId: 'outsider', name: 'Legacy', slug: 'legacy', status: 'published' },
  ]);
  await db.insert(siteCollaborators).values([
    { id: 'view', siteId: 'private', userId: 'viewer', role: 'viewer' },
    { id: 'edit', siteId: 'private', userId: 'editor', role: 'editor' },
  ]);
  await db.insert(pages).values({
    id: 'notes',
    siteId: 'private',
    title: 'Client notes',
    slug: 'notes',
    path: '/notes',
    status: 'published',
    blocks: [{ type: 'text', text: 'Confidential client budget 12345' }],
  });
  documentId = (
    await pipeline.ingest({
      workspaceId: 'private',
      sourceType: 'admin_collection',
      sourceCollection: 'pages',
      sourceId: 'notes',
      rawContent: 'Forged payload should never be embedded',
    })
  ).documentId;
});
afterAll(async () => {
  await testDb?.close();
});

describe('current source authorization before RAG text leaves the database', () => {
  it('indexes canonical private content and admits only current members', async () => {
    expect(await search()).toEqual([]);
    expect(await search('outsider')).toEqual([]);
    expect(await search('shell-admin')).toEqual([]);
    expect(await search('viewer', 'other')).toEqual([]);
    const results = await search('viewer');
    expect(results).toHaveLength(1);
    expect(results[0]?.chunk.content).toContain('Confidential client budget 12345');
    expect(results[0]?.chunk.content).not.toContain('Forged');
    expect(results[0]?.chunk.content).not.toContain('"blocks"');
  });

  it('rechecks publication and preserves editor draft access', async () => {
    await db.update(pages).set({ status: 'draft' }).where(eq(pages.id, 'notes'));
    expect(await search('viewer')).toEqual([]);
    expect(await search('editor')).toHaveLength(1);
    expect(
      await service.getChunksByDocument(documentId, { userId: 'viewer', deploymentMode: 'hosted' }),
    ).toEqual([]);
    await db.update(pages).set({ status: 'published' }).where(eq(pages.id, 'notes'));
    expect(await search('viewer')).toHaveLength(1);
  });

  it('rechecks private/public transitions without requiring reindexing', async () => {
    await db.update(sites).set({ visibility: 'public' }).where(eq(sites.id, 'private'));
    expect(await search()).toHaveLength(1);
    await db.update(sites).set({ visibility: 'private' }).where(eq(sites.id, 'private'));
    expect(await search()).toEqual([]);
  });

  it('excludes stale and legacy-global chunks before rerank or summarization', async () => {
    await db.insert(ragDocuments).values({
      id: 'legacy',
      workspaceId: 'default',
      sourceType: 'admin_collection',
      sourceCollection: 'pages',
      sourceId: 'notes',
      rawContent: 'Legacy confidential body',
      status: 'indexed',
    });
    await db.insert(ragChunks).values({
      id: 'legacy-chunk',
      documentId: 'legacy',
      workspaceId: 'default',
      content: 'Legacy confidential body',
      embedding: vector,
    });
    expect(await search(undefined, 'default')).toEqual([]);
    expect(await search('outsider', 'default')).toEqual([]);
    await db
      .update(pages)
      .set({ blocks: [{ type: 'text', text: 'Current sanitized body' }] })
      .where(eq(pages.id, 'notes'));
    expect(await search('editor')).toEqual([]);
    const chat = vi.fn();
    const llm = { chat } as unknown as LLMClient;
    expect(
      await hybridSearch('budget', db, async () => vector, {
        workspaceId: 'private',
        userId: 'editor',
        deploymentMode: 'hosted',
        mode: 'accuracy',
        rerank: true,
        llmClient: llm,
      }),
    ).toEqual([]);
    expect(
      (
        await createDocumentSummarizerTool(db, llm, {
          userId: 'editor',
          deploymentMode: 'hosted',
        }).execute({ documentId })
      ).success,
    ).toBe(false);
    expect(chat).not.toHaveBeenCalled();
    documentId = (
      await pipeline.ingest({
        workspaceId: 'private',
        sourceType: 'admin_collection',
        sourceCollection: 'pages',
        sourceId: 'notes',
        rawContent: '',
      })
    ).documentId;
    expect(await db.select().from(ragDocuments).where(eq(ragDocuments.id, 'legacy'))).toEqual([]);
    expect((await search('viewer'))[0]?.chunk.content).toContain('Current sanitized body');
  });

  it('does not authorize a current source snapshot under a different site label', async () => {
    const [current] = await db.select().from(ragDocuments).where(eq(ragDocuments.id, documentId));
    await db.insert(ragDocuments).values({
      id: 'wrong-site-copy',
      workspaceId: 'other',
      sourceType: 'admin_collection',
      sourceCollection: 'pages',
      sourceId: 'notes',
      rawContent: current?.rawContent,
      status: 'indexed',
    });
    await db.insert(ragChunks).values({
      id: 'wrong-site-chunk',
      documentId: 'wrong-site-copy',
      workspaceId: 'other',
      content: 'Current sanitized body',
      embedding: vector,
    });
    expect(await search('outsider', 'other')).toEqual([]);
  });

  it('preserves owned site text documents while withholding them from public readers', async () => {
    const result = await pipeline.ingest({
      workspaceId: 'other',
      sourceType: 'text',
      rawContent: 'Site operator private working notes',
    });
    expect(await search(undefined, 'other')).toEqual([]);
    expect(await search('viewer', 'other')).toEqual([]);
    expect(await search('outsider', 'other')).toHaveLength(1);
    expect(await service.getChunksByDocument(result.documentId)).toEqual([]);
    expect(
      await service.getChunksByDocument(result.documentId, {
        userId: 'outsider',
        deploymentMode: 'hosted',
      }),
    ).toHaveLength(1);
  });

  it('rechecks revoked memberships, account status and soft-deleted source', async () => {
    await db.delete(siteCollaborators).where(eq(siteCollaborators.id, 'view'));
    expect(await search('viewer')).toEqual([]);
    await db.update(users).set({ status: 'suspended' }).where(eq(users.id, 'editor'));
    expect(await search('editor')).toEqual([]);
    await db.update(pages).set({ deletedAt: new Date() }).where(eq(pages.id, 'notes'));
    expect(await search('owner')).toEqual([]);
  });

  it('rejects workspace and collection ambiguity at the ingestion owner', async () => {
    await expect(
      pipeline.ingest({
        workspaceId: 'other',
        sourceType: 'admin_collection',
        sourceCollection: 'pages',
        sourceId: 'notes',
        rawContent: '',
      }),
    ).rejects.toThrow('Page source');
    await expect(
      pipeline.ingest({
        workspaceId: 'private',
        sourceType: 'admin_collection',
        sourceCollection: 'posts',
        sourceId: 'post',
        rawContent: '',
      }),
    ).rejects.toThrow('site-backed');
    const indexer = new AdminIndexer({
      ingestionPipeline: pipeline,
      enabledCollections: ['pages'],
    });
    await expect(
      indexer.onDocumentChanged({ collection: 'pages', id: 'notes', operation: 'create', doc: {} }),
    ).rejects.toThrow('explicit site');
  });
});
