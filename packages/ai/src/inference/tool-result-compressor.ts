/**
 * Tool Result Compressor
 *
 * Deterministic, per-tool-type compression of tool results based on model tier.
 * Small models get aggressively truncated output; large models get full output.
 *
 * No LLM-based summarization — all compression is structural (head/tail,
 * match limits, line limits) so it's fast and predictable.
 */

import type { ModelTier } from './context-budget.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface CompressorConfig {
  /** Override per-tool limits. Keys are tool names, values are per-tier limits. */
  toolLimits?: Record<string, Partial<Record<ModelTier, ToolLimits>>>;
}

export interface ToolLimits {
  /** Max lines of output content */
  maxLines: number;
  /** Max matches/results for search tools */
  maxMatches: number;
  /** Whether to include head+tail or just head */
  headTailSplit: boolean;
}

const DEFAULT_LIMITS: Record<ModelTier, ToolLimits> = {
  small: { maxLines: 50, maxMatches: 5, headTailSplit: true },
  medium: { maxLines: 200, maxMatches: 20, headTailSplit: true },
  large: { maxLines: 2000, maxMatches: 100, headTailSplit: false },
};

/** Per-tool overrides for specific compression behavior */
const TOOL_SPECIFIC_LIMITS: Record<string, Partial<Record<ModelTier, Partial<ToolLimits>>>> = {
  file_read: {
    small: { maxLines: 60, headTailSplit: true },
    medium: { maxLines: 200, headTailSplit: true },
    large: { maxLines: 2000, headTailSplit: false },
  },
  file_grep: {
    small: { maxLines: 40, maxMatches: 5 },
    medium: { maxLines: 150, maxMatches: 20 },
    large: { maxLines: 1000, maxMatches: 100 },
  },
  file_glob: {
    small: { maxLines: 30, maxMatches: 10 },
    medium: { maxLines: 100, maxMatches: 30 },
    large: { maxLines: 500, maxMatches: 100 },
  },
  shell_exec: {
    small: { maxLines: 30, headTailSplit: true },
    medium: { maxLines: 100, headTailSplit: true },
    large: { maxLines: 500, headTailSplit: false },
  },
  git_ops: {
    small: { maxLines: 40, headTailSplit: true },
    medium: { maxLines: 150, headTailSplit: true },
    large: { maxLines: 800, headTailSplit: false },
  },
  project_context: {
    small: { maxLines: 40, maxMatches: 3 },
    medium: { maxLines: 120, maxMatches: 8 },
    large: { maxLines: 500, maxMatches: 20 },
  },
};

// ---------------------------------------------------------------------------
// Compressor
// ---------------------------------------------------------------------------

let config: CompressorConfig = {};

export function configureCompressor(overrides: CompressorConfig): void {
  config = { ...overrides };
}

/**
 * Get the effective limits for a given tool and model tier.
 */
export function getLimitsForTool(toolName: string, tier: ModelTier): ToolLimits {
  const base = { ...DEFAULT_LIMITS[tier] };

  // Apply built-in tool-specific overrides
  const toolOverrides = TOOL_SPECIFIC_LIMITS[toolName]?.[tier];
  if (toolOverrides) {
    Object.assign(base, toolOverrides);
  }

  // Apply user-configured overrides
  const userOverrides = config.toolLimits?.[toolName]?.[tier];
  if (userOverrides) {
    Object.assign(base, userOverrides);
  }

  return base;
}

/**
 * Compress a tool result's content string for a given model tier.
 * Returns the compressed content string (or original if within limits).
 */
export function compressToolResult(toolName: string, content: string, tier: ModelTier): string {
  if (!content) return content;

  // Large tier with no tool-specific limit: pass through
  if (tier === 'large' && !TOOL_SPECIFIC_LIMITS[toolName]?.large?.maxLines) {
    return content;
  }

  const limits = getLimitsForTool(toolName, tier);
  const lines = content.split('\n');

  if (lines.length <= limits.maxLines) {
    return content;
  }

  return truncateLines(lines, limits);
}

/**
 * Compress grep/glob search results by limiting match count.
 * Operates on structured content where each match is a block
 * separated by blank lines or a consistent prefix pattern.
 */
export function compressSearchResult(toolName: string, content: string, tier: ModelTier): string {
  if (!content) return content;

  const limits = getLimitsForTool(toolName, tier);

  // For grep results: blocks separated by "--" or blank lines
  if (toolName === 'file_grep') {
    return compressGrepOutput(content, limits);
  }

  // For glob results: one file per line
  if (toolName === 'file_glob') {
    return compressFileList(content, limits);
  }

  // For project_context: blocks separated by "---"
  if (toolName === 'project_context') {
    return compressBlockResults(content, limits, '---');
  }

  // Fallback: line-based truncation
  return compressToolResult(toolName, content, tier);
}

// ---------------------------------------------------------------------------
// Internal compression strategies
// ---------------------------------------------------------------------------

function truncateLines(lines: string[], limits: ToolLimits): string {
  if (limits.headTailSplit) {
    const headCount = Math.ceil(limits.maxLines * 0.7);
    const tailCount = limits.maxLines - headCount;
    const head = lines.slice(0, headCount);
    const tail = lines.slice(-tailCount);
    const omitted = lines.length - headCount - tailCount;
    return [...head, `\n... (${omitted} lines omitted) ...\n`, ...tail].join('\n');
  }

  // Head-only truncation
  const head = lines.slice(0, limits.maxLines);
  const omitted = lines.length - limits.maxLines;
  return [...head, `\n... (${omitted} more lines) ...\n`].join('\n');
}

function compressGrepOutput(content: string, limits: ToolLimits): string {
  // Grep results: "file:line: content" with "--" separators for context groups
  const lines = content.split('\n');
  const matchLines: string[] = [];
  let matchCount = 0;

  for (const line of lines) {
    if (matchCount >= limits.maxMatches && !line.startsWith('--') && line.trim()) {
      continue;
    }

    // Count actual match lines (not separators or context)
    if (line.trim() && !line.startsWith('--')) {
      matchCount++;
    }

    matchLines.push(line);

    if (matchCount >= limits.maxMatches) {
      break;
    }
  }

  // Apply line limit on top of match limit
  if (matchLines.length > limits.maxLines) {
    return truncateLines(matchLines, limits);
  }

  const remaining = lines.length - matchLines.length;
  if (remaining > 0) {
    matchLines.push(
      `\n... (${remaining} more lines, showing first ${limits.maxMatches} matches) ...`,
    );
  }

  return matchLines.join('\n');
}

function compressFileList(content: string, limits: ToolLimits): string {
  const files = content.split('\n').filter((l) => l.trim());

  if (files.length <= limits.maxMatches) {
    return content;
  }

  const shown = files.slice(0, limits.maxMatches);
  const remaining = files.length - limits.maxMatches;
  return [...shown, `\n... and ${remaining} more files ...`].join('\n');
}

function compressBlockResults(content: string, limits: ToolLimits, separator: string): string {
  const blocks = content.split(separator);

  if (blocks.length <= limits.maxMatches) {
    // Still apply line limit
    const lines = content.split('\n');
    if (lines.length <= limits.maxLines) return content;
    return truncateLines(lines, limits);
  }

  const shown = blocks.slice(0, limits.maxMatches);
  const remaining = blocks.length - limits.maxMatches;
  return [...shown, `\n... (${remaining} more results) ...\n`].join(separator);
}
