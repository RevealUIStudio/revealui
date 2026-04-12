/**
 * Document Summarizer Tool
 *
 * Fetches all chunks for a RAG document and either returns them directly
 * (if short enough) or asks the LLM for a summary.
 */

import type { Database } from '@revealui/db/client';
import { z } from 'zod/v4';
import { RagVectorService } from '../ingestion/rag-vector-service.js';
import type { LLMClient } from '../llm/client.js';
import type { Tool, ToolResult } from './base.js';

const SummarizerParams = z.object({
  documentId: z.string().min(1),
  focusQuestion: z.string().optional(),
});

const SHORT_DOCUMENT_TOKENS = 4000;
const CHARS_PER_TOKEN = 4;

export function createDocumentSummarizerTool(_db: Database, llmClient: LLMClient): Tool {
  const vectorService = new RagVectorService();

  return {
    name: 'document_summarize',
    description:
      'Summarize a RAG document by ID. Optionally focus the summary on a specific question. Use when a web_scrape result was truncated.',

    parameters: SummarizerParams,

    async execute(params: unknown): Promise<ToolResult> {
      const start = Date.now();
      const parsed = SummarizerParams.safeParse(params);
      if (!parsed.success) {
        return { success: false, error: `Invalid parameters: ${parsed.error.message}` };
      }

      const { documentId, focusQuestion } = parsed.data;

      try {
        const chunks = await vectorService.getChunksByDocument(documentId);
        if (chunks.length === 0) {
          return { success: false, error: `Document "${documentId}" not found or has no chunks` };
        }

        const fullContent = chunks.map((c) => c.content).join('\n\n');
        const estimatedTokens = Math.ceil(fullContent.length / CHARS_PER_TOKEN);

        // Short document  -  return directly without LLM call
        if (estimatedTokens <= SHORT_DOCUMENT_TOKENS) {
          return {
            success: true,
            data: {
              documentId,
              summary: fullContent,
              wordCount: fullContent.split(/\s+/).filter((w) => w.length > 0).length,
              summarized: false,
            },
            metadata: { executionTime: Date.now() - start },
          };
        }

        // Long document  -  summarize with LLM
        const focusInstruction = focusQuestion
          ? `Focus especially on answering: "${focusQuestion}"`
          : '';

        const response = await llmClient.chat([
          {
            role: 'system',
            content:
              `Summarize the following document, preserving key facts, figures, and conclusions. ${focusInstruction}`.trim(),
          },
          { role: 'user', content: fullContent },
        ]);

        return {
          success: true,
          data: {
            documentId,
            summary: response.content,
            wordCount: response.content.split(/\s+/).filter((w) => w.length > 0).length,
            summarized: true,
            chunkCount: chunks.length,
          },
          metadata: {
            executionTime: Date.now() - start,
            tokensUsed: response.usage?.totalTokens,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}
