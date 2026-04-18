/**
 * Reconciliation Service - LLM-powered fact resolution for multi-agent memory.
 *
 * Reads shared facts from a coordination session, groups related facts,
 * calls an LLM to determine canonical truths, resolve contradictions,
 * and deduplicate. Produces reconciled memories for Layer 3.
 *
 * Layer 3 of the multi-agent shared memory architecture.
 */

export interface SharedFactInput {
  id: string;
  agentId: string;
  content: string;
  factType: string;
  confidence: number;
  tags: string[];
  sourceRef?: Record<string, unknown> | null;
}

export interface ReconciledMemory {
  content: string;
  type: string;
  sourceFactIds: string[];
  confidence: number;
}

export interface Contradiction {
  factIds: string[];
  description: string;
  resolution: string;
}

export interface ReconciliationResult {
  canonicalFacts: ReconciledMemory[];
  contradictions: Contradiction[];
  duplicates: string[][];
  summary: string;
}

/**
 * Build the reconciliation prompt for an LLM.
 * The prompt asks the model to analyze facts from multiple agents and
 * produce a structured reconciliation result.
 */
export function buildReconciliationPrompt(
  facts: SharedFactInput[],
  scratchpadContent?: Record<string, unknown>,
): string {
  const factList = facts
    .map(
      (f, i) =>
        `${i + 1}. [${f.factType}] (agent: ${f.agentId}, confidence: ${f.confidence}) ${f.content}` +
        (f.tags.length > 0 ? ` [tags: ${f.tags.join(', ')}]` : ''),
    )
    .join('\n');

  const scratchpadSection = scratchpadContent
    ? `\n\nShared scratchpad content:\n${JSON.stringify(scratchpadContent, null, 2)}`
    : '';

  return `You are reconciling discoveries from multiple AI agents working on the same task.

Facts discovered by agents:
${factList}
${scratchpadSection}

Analyze these facts and produce a JSON response with:
1. "canonicalFacts": Array of canonical truths. For each:
   - "content": The canonical fact statement
   - "type": One of: fact, preference, decision, warning, skill
   - "sourceFactIds": Array of source fact indices (1-based) that support this
   - "confidence": 0-1 confidence score
2. "contradictions": Array of contradictions found. For each:
   - "factIndices": The conflicting fact indices
   - "description": What contradicts
   - "resolution": How to resolve (which is correct and why)
3. "duplicates": Array of arrays of fact indices that say the same thing
4. "summary": One-sentence summary of the reconciliation

Rules:
- Merge duplicate facts into one canonical fact
- When facts contradict, determine which is correct based on confidence and specificity
- Preserve the most specific and actionable version of each fact
- Do not invent facts not supported by the inputs

Respond with ONLY valid JSON, no markdown fencing.`;
}

/**
 * Parse the LLM response into a structured reconciliation result.
 * Maps 1-based fact indices back to actual fact IDs.
 */
export function parseReconciliationResponse(
  response: string,
  facts: SharedFactInput[],
): ReconciliationResult {
  const parsed = JSON.parse(response) as {
    canonicalFacts?: Array<{
      content: string;
      type: string;
      sourceFactIds?: number[];
      confidence?: number;
    }>;
    contradictions?: Array<{
      factIndices?: number[];
      description?: string;
      resolution?: string;
    }>;
    duplicates?: number[][];
    summary?: string;
  };

  const mapIndices = (indices: number[]): string[] =>
    indices
      .filter((i) => i >= 1 && i <= facts.length)
      .map((i) => facts[i - 1]?.id)
      .filter((id): id is string => id !== undefined);

  return {
    canonicalFacts: (parsed.canonicalFacts ?? []).map((cf) => ({
      content: cf.content,
      type: cf.type,
      sourceFactIds: mapIndices(cf.sourceFactIds ?? []),
      confidence: cf.confidence ?? 1.0,
    })),
    contradictions: (parsed.contradictions ?? []).map((c) => ({
      factIds: mapIndices(c.factIndices ?? []),
      description: c.description ?? '',
      resolution: c.resolution ?? '',
    })),
    duplicates: (parsed.duplicates ?? []).map((group) => mapIndices(group)),
    summary: parsed.summary ?? 'Reconciliation complete.',
  };
}

/**
 * Simple heuristic reconciliation (no LLM required).
 * Deduplicates by normalized content and groups by type.
 * Use this as a fallback when no LLM provider is configured.
 */
export function reconcileHeuristic(facts: SharedFactInput[]): ReconciliationResult {
  const seen = new Map<string, string[]>();
  const canonicalFacts: ReconciledMemory[] = [];
  const duplicates: string[][] = [];

  for (const fact of facts) {
    const normalized = fact.content.toLowerCase().trim();
    const existing = seen.get(normalized);
    if (existing) {
      existing.push(fact.id);
    } else {
      seen.set(normalized, [fact.id]);
    }
  }

  for (const [, ids] of seen) {
    if (ids.length > 1) {
      duplicates.push(ids);
    }
    const sourceFact = facts.find((f) => f.id === ids[0]);
    if (sourceFact) {
      const memoryType =
        sourceFact.factType === 'bug' || sourceFact.factType === 'warning' ? 'warning' : 'fact';
      canonicalFacts.push({
        content: sourceFact.content,
        type: memoryType,
        sourceFactIds: ids,
        confidence: sourceFact.confidence,
      });
    }
  }

  return {
    canonicalFacts,
    contradictions: [],
    duplicates,
    summary: `Reconciled ${facts.length} facts into ${canonicalFacts.length} canonical facts (${duplicates.length} duplicates).`,
  };
}
