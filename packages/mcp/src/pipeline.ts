/**
 * Tool Pipeline
 *
 * Lightweight tool composition that lets agents chain MCP tool calls
 * declaratively. Steps execute sequentially, with data flowing between
 * them via `$ref` parameter references.
 *
 * @example
 * ```typescript
 * const result = await executePipeline(hypervisor, ctx, [
 *   {
 *     label: 'customer',
 *     tool: '@@mcp_stripe_create_customer',
 *     params: { email: 'user@example.com' },
 *   },
 *   {
 *     label: 'payment',
 *     tool: '@@mcp_stripe_create_payment_intent',
 *     params: {
 *       customer: { $ref: 'customer.id' },
 *       amount: 2000,
 *       currency: 'usd',
 *     },
 *   },
 * ]);
 * ```
 */

import type { MCPHypervisor, MCPTenantContext } from './hypervisor.js';

// =============================================================================
// Types
// =============================================================================

export interface PipelineStep {
  /** Namespaced tool name (e.g., @@mcp_stripe_create_payment_intent) */
  tool: string;
  /** Parameters  -  can reference previous step outputs via $ref syntax */
  params: Record<string, unknown>;
  /** Optional: only run if condition is met */
  when?: (previousResults: Map<string, unknown>) => boolean;
  /** Step label for referencing in later steps */
  label?: string;
}

export interface PipelineStepResult {
  label: string;
  tool: string;
  success: boolean;
  data?: unknown;
  error?: string;
  durationMs: number;
}

export interface PipelineResult {
  success: boolean;
  steps: PipelineStepResult[];
  totalDurationMs: number;
}

// =============================================================================
// Constants
// =============================================================================

const MCP_TOOL_PREFIX = '@@mcp_';

// =============================================================================
// Pipeline executor
// =============================================================================

/**
 * Execute a sequence of tool calls with data flowing between steps.
 *
 * Parameter references: use `{ "$ref": "step_label.path.to.value" }`
 * to reference output from a previous step.
 *
 * Tools are identified by their namespaced name (`@@mcp_{server}_{tool}`)
 * and dispatched through the hypervisor's tenant-scoped call path.
 */
export async function executePipeline(
  hypervisor: MCPHypervisor,
  ctx: MCPTenantContext,
  steps: PipelineStep[],
): Promise<PipelineResult> {
  const results = new Map<string, unknown>();
  const stepResults: PipelineStepResult[] = [];
  const pipelineStart = Date.now();

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (!step) continue;

    const label = step.label ?? `step_${i}`;
    const stepStart = Date.now();

    // Check condition
    if (step.when && !step.when(results)) {
      stepResults.push({
        label,
        tool: step.tool,
        success: true,
        data: { skipped: true },
        durationMs: 0,
      });
      continue;
    }

    // Resolve $ref parameters
    const resolvedParams = resolveRefs(step.params, results);

    try {
      // Parse the namespaced tool name into server + tool
      const { serverName, toolName } = parseNamespacedTool(step.tool);

      // Call the tool through the hypervisor's tenant-scoped path
      const response = await hypervisor.callToolForTenant(
        serverName,
        ctx.tenantId,
        toolName,
        resolvedParams,
      );

      // Attempt to parse text content responses as JSON
      const data = extractResponseData(response);

      results.set(label, data);
      stepResults.push({
        label,
        tool: step.tool,
        success: true,
        data,
        durationMs: Date.now() - stepStart,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      stepResults.push({
        label,
        tool: step.tool,
        success: false,
        error: errorMsg,
        durationMs: Date.now() - stepStart,
      });

      // Pipeline fails on first error
      return {
        success: false,
        steps: stepResults,
        totalDurationMs: Date.now() - pipelineStart,
      };
    }
  }

  return {
    success: true,
    steps: stepResults,
    totalDurationMs: Date.now() - pipelineStart,
  };
}

// =============================================================================
// Tool name parsing
// =============================================================================

/**
 * Parse a namespaced tool name like `@@mcp_stripe_create_payment_intent`
 * into `{ serverName: 'stripe', toolName: 'create_payment_intent' }`.
 *
 * The convention is `@@mcp_{serverName}_{toolName}` where the server name
 * is the first segment after the prefix and the tool name is everything
 * after it (may contain underscores).
 */
function parseNamespacedTool(namespacedName: string): {
  serverName: string;
  toolName: string;
} {
  if (!namespacedName.startsWith(MCP_TOOL_PREFIX)) {
    throw new Error(`Invalid tool name "${namespacedName}": must start with "${MCP_TOOL_PREFIX}"`);
  }

  const rest = namespacedName.slice(MCP_TOOL_PREFIX.length);
  const firstUnderscore = rest.indexOf('_');

  if (firstUnderscore === -1 || firstUnderscore === 0) {
    throw new Error(
      `Invalid tool name "${namespacedName}": expected format "${MCP_TOOL_PREFIX}{server}_{tool}"`,
    );
  }

  return {
    serverName: rest.slice(0, firstUnderscore),
    toolName: rest.slice(firstUnderscore + 1),
  };
}

// =============================================================================
// Response extraction
// =============================================================================

/**
 * Attempt to extract structured data from an MCP tool response.
 * If the response contains a text content block with valid JSON, parse it.
 * Otherwise return the raw response.
 */
function extractResponseData(response: unknown): unknown {
  if (
    typeof response === 'object' &&
    response !== null &&
    'content' in response &&
    Array.isArray((response as { content: unknown }).content)
  ) {
    const content = (response as { content: unknown[] }).content;
    const first = content[0];
    if (
      first &&
      typeof first === 'object' &&
      'type' in first &&
      (first as { type: string }).type === 'text' &&
      'text' in first
    ) {
      try {
        return JSON.parse((first as { text: string }).text);
      } catch {
        // Not JSON  -  return raw text
        return (first as { text: string }).text;
      }
    }
  }
  return response;
}

// =============================================================================
// $ref resolution
// =============================================================================

/**
 * Resolve `$ref` values in params by looking up previous step results.
 * Format: `{ "$ref": "step_label.path.to.value" }`
 */
function resolveRefs(
  params: Record<string, unknown>,
  results: Map<string, unknown>,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(params)) {
    if (isRef(value)) {
      resolved[key] = resolveRef(value.$ref, results);
    } else if (Array.isArray(value)) {
      resolved[key] = resolveRefsInArray(value, results);
    } else if (typeof value === 'object' && value !== null) {
      resolved[key] = resolveRefs(value as Record<string, unknown>, results);
    } else {
      resolved[key] = value;
    }
  }

  return resolved;
}

function resolveRefsInArray(items: unknown[], results: Map<string, unknown>): unknown[] {
  return items.map((item) => {
    if (isRef(item)) {
      return resolveRef(item.$ref, results);
    }
    if (Array.isArray(item)) {
      return resolveRefsInArray(item, results);
    }
    if (typeof item === 'object' && item !== null) {
      return resolveRefs(item as Record<string, unknown>, results);
    }
    return item;
  });
}

function isRef(value: unknown): value is { $ref: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    '$ref' in value &&
    typeof (value as Record<string, unknown>).$ref === 'string'
  );
}

function resolveRef(ref: string, results: Map<string, unknown>): unknown {
  const parts = ref.split('.');
  const stepLabel = parts[0];

  if (!stepLabel) {
    throw new Error('Pipeline ref error: empty $ref string');
  }

  const data = results.get(stepLabel);
  if (data === undefined) {
    throw new Error(`Pipeline ref error: step "${stepLabel}" not found`);
  }

  let current: unknown = data;
  for (let i = 1; i < parts.length; i++) {
    if (current === null || current === undefined) {
      throw new Error(
        `Pipeline ref error: cannot traverse "${ref}" — null at "${parts.slice(0, i + 1).join('.')}"`,
      );
    }
    const segment = parts[i];
    if (!segment) continue;
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}
