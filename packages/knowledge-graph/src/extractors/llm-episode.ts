/**
 * P3 — LLM structured extraction for unstructured episodes (GAP-349).
 *
 * Deterministic Tier-1 extractors remain the default for `revkg scan`.
 * This module turns free-text (handoffs, memories, agent notes) into
 * candidate nodes/edges via a caller-supplied completer (typically
 * `@revealui/ai` Ollama chat with JSON mode). No hard import of @revealui/ai
 * so the package stays installable without Pro optional deps.
 *
 * Contradictions: ingest stays additive by default. Pass
 * `invalidateContradictions: true` to ingestEpisode (or use CLI
 * `extract` / `ingest-handoffs`) to temporally invalidate prior edges that
 * share endpoints+relation but differ in fact (invalidate-not-delete).
 */

import { z } from 'zod';
import type { EpisodeIngestInput } from '../ingest/engine.js';
import { EDGE_RELATIONS, NODE_KINDS } from '../ontology/index.js';
import type { EdgeInput, EpisodeInput, NodeInput } from '../types.js';

/** Models often emit null for optional fields — coerce null → undefined. */
const optionalRepo = z.preprocess(
  (v) => (v === null || v === undefined || v === '' ? undefined : v),
  z.string().max(100).optional(),
);

const ExtractedNodeSchema = z.object({
  kind: z.enum(NODE_KINDS),
  name: z.string().min(1).max(200),
  naturalKey: z.string().min(1).max(500),
  repo: optionalRepo,
  summary: z.preprocess(
    (v) => (v === null || v === undefined ? undefined : v),
    z.string().max(2000).optional(),
  ),
});

const ExtractedEdgeSchema = z.object({
  sourceNaturalKey: z.string().min(1).max(500),
  targetNaturalKey: z.string().min(1).max(500),
  sourceKind: z.enum(NODE_KINDS),
  targetKind: z.enum(NODE_KINDS),
  relation: z.enum(EDGE_RELATIONS),
  fact: z.string().min(1).max(2000),
  repo: optionalRepo,
});

export const LlmExtractionSchema = z.object({
  nodes: z.array(ExtractedNodeSchema).max(50),
  edges: z.array(ExtractedEdgeSchema).max(100),
});

export type LlmExtraction = z.infer<typeof LlmExtractionSchema>;

/** JSON-schema-ish prompt body (string) so callers do not need zod-to-json. */
export const LLM_EXTRACTION_PROMPT = `You extract knowledge-graph candidates from text.
Return ONLY valid JSON matching:
{
  "nodes": [{ "kind": string, "name": string, "naturalKey": string, "repo"?: string, "summary"?: string }],
  "edges": [{ "sourceNaturalKey": string, "targetNaturalKey": string, "sourceKind": string, "targetKind": string, "relation": string, "fact": string, "repo"?: string }]
}
Kinds: ${NODE_KINDS.join(', ')}
Relations: ${EDGE_RELATIONS.join(', ')}
Rules: naturalKey stable and path-like when possible; never invent secrets; prefer concept/relates-to when unsure.`;

export type LlmCompleter = (prompt: string, userText: string) => Promise<string>;

export interface ExtractEpisodeOptions {
  /** Injected LLM JSON completer (tests stub; production wires @revealui/ai). */
  complete: LlmCompleter;
  source: string;
  siteId: string;
  episodeType?: EpisodeInput['episodeType'];
  referenceTime?: Date;
  /** Max characters of user text sent to the model (default 24k). */
  maxInputChars?: number;
}

/**
 * Run LLM extraction and map to EpisodeIngestInput for ingestEpisode().
 * Throws ZodError if the model returns invalid JSON shape.
 */
export async function extractEpisodeFromText(
  text: string,
  options: ExtractEpisodeOptions,
): Promise<{ extraction: LlmExtraction; ingest: EpisodeIngestInput }> {
  const maxIn = options.maxInputChars ?? 24_000;
  const clipped = text.length > maxIn ? text.slice(0, maxIn) : text;
  const raw = await options.complete(LLM_EXTRACTION_PROMPT, clipped);
  const jsonText = extractJsonObject(raw);
  const parsed = LlmExtractionSchema.parse(JSON.parse(jsonText) as unknown);
  const referenceTime = options.referenceTime ?? new Date();

  const nodes: NodeInput[] = parsed.nodes.map((n) => ({
    kind: n.kind,
    name: n.name,
    naturalKey: n.naturalKey,
    repo: n.repo,
    summary: n.summary,
  }));

  const edges: EdgeInput[] = parsed.edges.map((e) => ({
    source: { kind: e.sourceKind, naturalKey: e.sourceNaturalKey },
    target: { kind: e.targetKind, naturalKey: e.targetNaturalKey },
    relation: e.relation,
    fact: e.fact,
    repo: e.repo,
  }));

  return {
    extraction: parsed,
    ingest: {
      episode: {
        episodeType: options.episodeType ?? 'agent-fact',
        source: options.source,
        siteId: options.siteId,
        content: clipped,
        referenceTime,
      },
      nodes,
      edges,
    },
  };
}

/** Prefer fenced JSON or first {...} object; zero authored regex. */
function extractJsonObject(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    return trimmed;
  }
  const fence = '```';
  const startFence = trimmed.indexOf(fence);
  if (startFence >= 0) {
    const after = trimmed.slice(startFence + fence.length);
    const nl = after.indexOf('\n');
    const bodyStart = nl >= 0 ? nl + 1 : 0;
    const endFence = after.indexOf(fence, bodyStart);
    if (endFence > bodyStart) {
      return after.slice(bodyStart, endFence).trim();
    }
  }
  const brace = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (brace >= 0 && last > brace) {
    return trimmed.slice(brace, last + 1);
  }
  return trimmed;
}
