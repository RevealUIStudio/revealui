/**
 * Ingestion Pipeline
 *
 * Orchestrates: parse → split → embed → store.
 * One document produces N chunks, each with a 768-dim embedding.
 */

import type { Database } from '@revealui/db/client';
import { ragChunks, ragDocuments } from '@revealui/db/schema/rag';
import { safeVectorInsert } from '@revealui/db/validation';
import { and, eq } from 'drizzle-orm';
import { createParser } from './file-parsers.js';
import { RecursiveCharacterSplitter } from './text-splitter.js';

export interface IngestRequest {
  workspaceId: string;
  sourceType: 'admin_collection' | 'url' | 'file' | 'text';
  sourceId?: string;
  sourceCollection?: string;
  title?: string;
  mimeType?: string;
  rawContent: string;
  chunkSize?: number;
  chunkOverlap?: number;
}

export interface IngestResult {
  documentId: string;
  chunkCount: number;
  status: 'indexed' | 'failed';
  error?: string;
}

function generateId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function estimateWordCount(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export class IngestionPipeline {
  private db: Database;
  private restDb: Database;
  private embeddingFn: (text: string) => Promise<number[]>;
  private splitter: RecursiveCharacterSplitter;

  constructor(db: Database, restDb: Database, embeddingFn: (text: string) => Promise<number[]>) {
    this.db = db;
    this.restDb = restDb;
    this.embeddingFn = embeddingFn;
    this.splitter = new RecursiveCharacterSplitter();
  }

  async ingest(req: IngestRequest): Promise<IngestResult> {
    const docId = generateId('rdoc');
    const now = new Date();

    // 1. Insert document row with status='processing', guarded by cross-DB ref check.
    // safeVectorInsert validates that workspaceId (= site ID) exists in NeonDB before
    // writing to the Supabase vector store, preventing orphaned RAG documents.
    await safeVectorInsert(
      this.restDb,
      async () =>
        this.db.insert(ragDocuments).values({
          id: docId,
          workspaceId: req.workspaceId,
          sourceType: req.sourceType,
          sourceId: req.sourceId ?? null,
          sourceCollection: req.sourceCollection ?? null,
          title: req.title ?? null,
          mimeType: req.mimeType ?? 'text/plain',
          rawContent: req.rawContent,
          wordCount: estimateWordCount(req.rawContent),
          tokenEstimate: estimateTokens(req.rawContent),
          status: 'processing',
          createdAt: now,
          updatedAt: now,
        }),
      { siteId: req.workspaceId },
    );

    try {
      // 2. Parse
      const parser = createParser(req.mimeType ?? 'text/plain');
      const { text } = parser.parse(req.rawContent);

      // 3. Split
      const chunks = this.splitter.split(text, {
        chunkSize: req.chunkSize ?? 512,
        overlap: req.chunkOverlap ?? 64,
      });

      // 4. Embed and insert each chunk
      for (const chunk of chunks) {
        const embedding = await this.embeddingFn(chunk.content);
        const chunkId = generateId('rchk');

        await this.db.insert(ragChunks).values({
          id: chunkId,
          documentId: docId,
          workspaceId: req.workspaceId,
          content: chunk.content,
          tokenCount: chunk.tokenCount,
          chunkIndex: chunk.index,
          embedding,
          embeddingModel: 'nomic-embed-text',
          metadata: chunk.metadata ?? {},
          createdAt: now,
        });
      }

      // 5. Mark as indexed
      await this.db
        .update(ragDocuments)
        .set({ status: 'indexed', indexedAt: now, updatedAt: now })
        .where(eq(ragDocuments.id, docId));

      return { documentId: docId, chunkCount: chunks.length, status: 'indexed' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      await this.db
        .update(ragDocuments)
        .set({ status: 'failed', errorMessage: message, updatedAt: new Date() })
        .where(eq(ragDocuments.id, docId));

      return { documentId: docId, chunkCount: 0, status: 'failed', error: message };
    }
  }

  async ingestBatch(docs: IngestRequest[]): Promise<IngestResult[]> {
    const results: IngestResult[] = [];
    const concurrencyLimit = 3;

    for (let i = 0; i < docs.length; i += concurrencyLimit) {
      const batch = docs.slice(i, i + concurrencyLimit);
      const batchResults = await Promise.all(batch.map((doc) => this.ingest(doc)));
      results.push(...batchResults);
    }

    return results;
  }

  async deleteDocument(documentId: string): Promise<void> {
    // Chunks cascade-delete via FK
    await this.db.delete(ragDocuments).where(eq(ragDocuments.id, documentId));
  }

  async deleteBySource(
    workspaceId: string,
    sourceCollection: string,
    sourceId: string,
  ): Promise<void> {
    // Find and delete documents by source identity
    const docs = await this.db
      .select({ id: ragDocuments.id })
      .from(ragDocuments)
      .where(
        and(
          eq(ragDocuments.workspaceId, workspaceId),
          eq(ragDocuments.sourceCollection, sourceCollection),
          eq(ragDocuments.sourceId, sourceId),
        ),
      );

    for (const doc of docs) {
      await this.deleteDocument(doc.id);
    }
  }
}
