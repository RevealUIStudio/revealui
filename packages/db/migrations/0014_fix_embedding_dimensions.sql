-- Fix embedding dimensions: 1536 (OpenAI) → 768 (Ollama nomic-embed-text)
--
-- RevealUI LLM policy: no OpenAI API until revenue. Embeddings are generated
-- by Ollama nomic-embed-text which produces 768-dimensional vectors.
-- The original schema was scaffolded with OpenAI's 1536-dim value by mistake.
--
-- pgvector does not support ALTER COLUMN for vector types; drop and re-add.
-- Any existing embeddings will be lost — this is acceptable at pre-launch.

ALTER TABLE "agent_contexts" DROP COLUMN IF EXISTS "embedding";
ALTER TABLE "agent_contexts" ADD COLUMN "embedding" vector(768);

ALTER TABLE "agent_memories" DROP COLUMN IF EXISTS "embedding";
ALTER TABLE "agent_memories" ADD COLUMN "embedding" vector(768);
