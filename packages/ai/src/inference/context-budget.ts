/**
 * Context Budget Policy
 * Model-tier-aware context allocation for the coding agent.
 * Ensures small models (BitNet 2B) get only essential context,
 * while large models (Claude, GPT-4) get full context.
 */

// ---------------------------------------------------------------------------
// Model Tiers
// ---------------------------------------------------------------------------

export type ModelTier = 'small' | 'medium' | 'large';

export interface ContextBudget {
  /** Max tokens for system prompt / instructions */
  systemPromptTokens: number;
  /** Max lines for tool result content */
  toolResultMaxLines: number;
  /** Max conversation history turns to keep */
  historyTurns: number;
  /** Max tokens for a single tool result */
  toolResultMaxTokens: number;
  /** Preamble tiers to include (1 = most important only) */
  preambleTiers: number[];
}

const BUDGETS: Record<ModelTier, ContextBudget> = {
  small: {
    systemPromptTokens: 400,
    toolResultMaxLines: 100,
    historyTurns: 2,
    toolResultMaxTokens: 500,
    preambleTiers: [1],
  },
  medium: {
    systemPromptTokens: 1200,
    toolResultMaxLines: 300,
    historyTurns: 6,
    toolResultMaxTokens: 2000,
    preambleTiers: [1, 2],
  },
  large: {
    systemPromptTokens: 4000,
    toolResultMaxLines: 2000,
    historyTurns: 20,
    toolResultMaxTokens: 8000,
    preambleTiers: [1, 2, 3],
  },
};

// ---------------------------------------------------------------------------
// Model Classification
// ---------------------------------------------------------------------------

/** Known model patterns → tier mapping */
const MODEL_TIER_PATTERNS: Array<{ pattern: RegExp; tier: ModelTier }> = [
  // Small: local quantized models
  { pattern: /bitnet/i, tier: 'small' },
  { pattern: /tinyllama/i, tier: 'small' },
  { pattern: /phi-[12]/i, tier: 'small' },
  { pattern: /\b[12]b\b/i, tier: 'small' },
  { pattern: /gguf.*q[24]/i, tier: 'small' },

  // Medium: mid-size local or fast cloud
  { pattern: /llama.*[78]b/i, tier: 'medium' },
  { pattern: /mistral.*7b/i, tier: 'medium' },
  { pattern: /gemma.*[79]b/i, tier: 'medium' },
  { pattern: /llama.*70b/i, tier: 'medium' },
  { pattern: /mixtral/i, tier: 'medium' },
  { pattern: /qwen.*[78]b/i, tier: 'medium' },
  { pattern: /deepseek.*[78]b/i, tier: 'medium' },

  // Large: cloud models with large context
  { pattern: /claude/i, tier: 'large' },
  { pattern: /gpt-[45]/i, tier: 'large' },
  { pattern: /gemini/i, tier: 'large' },
  { pattern: /llama.*405b/i, tier: 'large' },
  { pattern: /deepseek.*v[23]/i, tier: 'large' },
];

/**
 * Classify a model name into a context budget tier
 */
export function classifyModel(modelName: string): ModelTier {
  for (const { pattern, tier } of MODEL_TIER_PATTERNS) {
    if (pattern.test(modelName)) return tier;
  }
  // Default to medium — safe middle ground
  return 'medium';
}

/**
 * Get the context budget for a model tier
 */
export function getContextBudget(tier: ModelTier): ContextBudget {
  return { ...BUDGETS[tier] };
}

/**
 * Get the context budget for a specific model
 */
export function getContextBudgetForModel(modelName: string): ContextBudget {
  return getContextBudget(classifyModel(modelName));
}

// ---------------------------------------------------------------------------
// Tool Result Truncation
// ---------------------------------------------------------------------------

/**
 * Truncate tool result content to fit within the model's context budget.
 * Uses deterministic truncation (head + tail) rather than LLM-based summarization.
 */
export function truncateToolResult(content: string, tier: ModelTier): string {
  const budget = BUDGETS[tier];
  const lines = content.split('\n');

  if (lines.length <= budget.toolResultMaxLines) {
    return content;
  }

  // Keep head and tail with a truncation marker
  const headLines = Math.ceil(budget.toolResultMaxLines * 0.7);
  const tailLines = budget.toolResultMaxLines - headLines;

  const head = lines.slice(0, headLines);
  const tail = lines.slice(-tailLines);
  const omitted = lines.length - headLines - tailLines;

  return [...head, `\n... (${omitted} lines omitted) ...\n`, ...tail].join('\n');
}

// ---------------------------------------------------------------------------
// History Pruning
// ---------------------------------------------------------------------------

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

/**
 * Prune conversation history to fit within the model's context budget.
 * Keeps the system message + most recent turns.
 */
export function pruneHistory(messages: Message[], tier: ModelTier): Message[] {
  const budget = BUDGETS[tier];

  // Always keep system messages
  const system = messages.filter((m) => m.role === 'system');
  const nonSystem = messages.filter((m) => m.role !== 'system');

  // Keep the most recent turns (each turn = user + assistant + tool messages)
  const maxMessages = budget.historyTurns * 3; // rough: 3 messages per turn
  const recent = nonSystem.slice(-maxMessages);

  return [...system, ...recent];
}
