/**
 * Task Decomposer
 *
 * Breaks complex multi-file instructions into focused single-step tasks
 * that small models can handle. Each step gets its own agentic loop with
 * only the context it needs.
 *
 * Strategy:
 * 1. Plan: send instruction to LLM with minimal context → get JSON step array
 * 2. Execute: each step runs as a focused agentic loop
 * 3. Synthesize: collect results, present summary
 */

import type { LLMClient } from '../llm/client.js';
import type { Tool, ToolResult } from '../tools/base.js';
import { classifyModel, getContextBudget, type ModelTier } from './context-budget.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DecomposedStep {
  /** Step number (1-indexed) */
  index: number;
  /** Focused instruction for this step */
  instruction: string;
  /** Which tools this step likely needs (hint for context selection) */
  toolHints?: string[];
  /** Files/paths this step is about (for targeted context loading) */
  targetPaths?: string[];
}

export interface DecompositionResult {
  /** Whether decomposition was needed and successful */
  decomposed: boolean;
  /** Original instruction */
  original: string;
  /** Individual steps (1 step = no decomposition needed) */
  steps: DecomposedStep[];
  /** Planning metadata */
  metadata?: {
    planningTime?: number;
    modelTier?: ModelTier;
  };
}

export interface StepResult {
  step: DecomposedStep;
  success: boolean;
  output: string;
  toolResults: ToolResult[];
  executionTime: number;
}

export interface DecomposerConfig {
  /** Max steps to decompose into (default: 5) */
  maxSteps: number;
  /** Model name for tier classification */
  modelName: string;
  /** Min complexity threshold — skip decomposition for simple tasks (default: 1) */
  minComplexityForDecomposition: number;
}

const DEFAULT_CONFIG: DecomposerConfig = {
  maxSteps: 5,
  modelName: 'unknown',
  minComplexityForDecomposition: 1,
};

let decomposerConfig: DecomposerConfig = { ...DEFAULT_CONFIG };

export function configureDecomposer(overrides: Partial<DecomposerConfig>): void {
  decomposerConfig = { ...DEFAULT_CONFIG, ...overrides };
}

// ---------------------------------------------------------------------------
// Complexity heuristics
// ---------------------------------------------------------------------------

/** Known complexity signals in an instruction */
const COMPLEXITY_SIGNALS = [
  /\band\b.*\band\b/i, // multiple "and" conjunctions
  /\bthen\b/i, // sequential steps
  /\bfirst\b.*\bthen\b/i, // explicit ordering
  /\bmultiple\b|\bseveral\b|\ball\b/i, // bulk operations
  /\brefactor\b|\bmigrate\b|\brewrite\b/i, // large-scope changes
  /\bacross\b.*\bfiles?\b/i, // cross-file operations
  /\bupdate\b.*\band\b.*\btest\b/i, // change + verify pattern
  /\bcreate\b.*\bwith\b.*\band\b/i, // create with multiple parts
];

/**
 * Estimate task complexity (0-10 scale) based on instruction text.
 * Used to decide whether decomposition is worthwhile.
 */
export function estimateComplexity(instruction: string): number {
  let score = 0;

  // Signal matching
  for (const signal of COMPLEXITY_SIGNALS) {
    if (signal.test(instruction)) score += 1.5;
  }

  // Length-based: longer instructions tend to be more complex
  const words = instruction.split(/\s+/).length;
  if (words > 30) score += 1;
  if (words > 60) score += 1;
  if (words > 100) score += 1;

  // Path/file references suggest multi-file work
  const pathRefs = instruction.match(/[\w/]+(?:[.-][\w/]+)*\.\w{1,5}/g) ?? [];
  if (pathRefs.length > 1) score += pathRefs.length * 0.5;

  return Math.min(10, score);
}

/**
 * Determine if a task should be decomposed based on model tier and complexity.
 */
export function shouldDecompose(instruction: string, modelTier: ModelTier): boolean {
  // Large models handle complex tasks natively
  if (modelTier === 'large') return false;

  const complexity = estimateComplexity(instruction);

  // Small models: decompose anything non-trivial
  if (modelTier === 'small') return complexity >= 2;

  // Medium models: only decompose complex tasks
  return complexity >= 4;
}

// ---------------------------------------------------------------------------
// Decomposition
// ---------------------------------------------------------------------------

const PLANNING_PROMPT = `You are a task planning assistant. Break the following instruction into simple, focused steps that can each be completed independently.

Rules:
- Each step should involve at most 1-2 tool calls
- Steps should be ordered by dependency (prerequisites first)
- Each step's instruction should be self-contained and specific
- Include file paths when known
- Return ONLY a JSON array of step objects

Output format:
[
  { "instruction": "Read the file src/index.ts to understand the current exports", "toolHints": ["file_read"], "targetPaths": ["src/index.ts"] },
  { "instruction": "Add the new export for MyComponent to src/index.ts", "toolHints": ["file_edit"], "targetPaths": ["src/index.ts"] }
]

Instruction to decompose:
`;

/**
 * Decompose a complex instruction into focused steps using the LLM.
 * Returns a single step with the original instruction if decomposition
 * is not needed or fails.
 */
export async function decomposeTask(
  instruction: string,
  llmClient: LLMClient,
  modelName?: string,
): Promise<DecompositionResult> {
  const startTime = Date.now();
  const tier = classifyModel(modelName ?? decomposerConfig.modelName);

  // Check if decomposition is needed
  if (!shouldDecompose(instruction, tier)) {
    return {
      decomposed: false,
      original: instruction,
      steps: [{ index: 1, instruction }],
      metadata: { planningTime: Date.now() - startTime, modelTier: tier },
    };
  }

  try {
    // Use a focused planning prompt — keep it small for small models
    const planningInstruction = `${PLANNING_PROMPT}${instruction}`;
    const budget = getContextBudget(tier);

    // For planning, we want minimal context
    const messages = [
      {
        role: 'system' as const,
        content: 'You output only valid JSON arrays. No markdown, no explanation.',
      },
      { role: 'user' as const, content: planningInstruction },
    ];

    let response = '';
    for await (const chunk of llmClient.stream(messages)) {
      if (chunk.content) response += chunk.content;
    }

    // Parse the JSON response
    const steps = parseStepArray(response, instruction);

    // Limit steps
    const maxSteps = Math.min(decomposerConfig.maxSteps, budget.historyTurns);
    const limited = steps.slice(0, maxSteps);

    return {
      decomposed: limited.length > 1,
      original: instruction,
      steps: limited.map((s, i) => ({ ...s, index: i + 1 })),
      metadata: { planningTime: Date.now() - startTime, modelTier: tier },
    };
  } catch {
    // Decomposition failed — fall back to single-step
    return {
      decomposed: false,
      original: instruction,
      steps: [{ index: 1, instruction }],
      metadata: { planningTime: Date.now() - startTime, modelTier: tier },
    };
  }
}

/**
 * Select tools relevant to a specific step based on tool hints.
 * Returns all tools if no hints are provided.
 */
export function selectToolsForStep(step: DecomposedStep, allTools: Tool[]): Tool[] {
  if (!step.toolHints?.length) return allTools;

  const hintSet = new Set(step.toolHints);
  const selected = allTools.filter((t) => hintSet.has(t.name));

  // Always include at least the hinted tools + fallback to all if none match
  return selected.length > 0 ? selected : allTools;
}

// ---------------------------------------------------------------------------
// JSON parsing
// ---------------------------------------------------------------------------

function parseStepArray(response: string, fallbackInstruction: string): DecomposedStep[] {
  // Extract JSON array from response (may have markdown wrapping)
  const jsonMatch = response.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return [{ index: 1, instruction: fallbackInstruction }];
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      instruction?: string;
      toolHints?: string[];
      targetPaths?: string[];
    }>;

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [{ index: 1, instruction: fallbackInstruction }];
    }

    return parsed
      .filter((step) => step.instruction && typeof step.instruction === 'string')
      .map((step, i) => ({
        index: i + 1,
        instruction: step.instruction as string,
        toolHints: Array.isArray(step.toolHints) ? step.toolHints : undefined,
        targetPaths: Array.isArray(step.targetPaths) ? step.targetPaths : undefined,
      }));
  } catch {
    return [{ index: 1, instruction: fallbackInstruction }];
  }
}
