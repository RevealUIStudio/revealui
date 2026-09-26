/**
 * Apply Stage 6 pre-authorize wraps to in-process agent tools (S6-3).
 *
 * Uses authorizeAgentTool (S6-2) + soft-fail denial + recordAgentToolDenied.
 * Implemented here (not a static `@revealui/ai` import) so apps/server stays
 * free of a hard Pro-package dependency at module load; the wrap contract
 * matches `packages/ai` `wrapToolWithGovernance`.
 *
 * Pass only admin/coding tools — not MCP `mcp_*` tools (unknown would deny;
 * remote MCP is gated separately).
 */

import { getLowTrustLimits } from '@revealui/security';
import type { AgentPrincipal } from './agent-principal.js';
import { principalFindGrant } from './agent-principal.js';
import {
  agentAdminPiiPermissionKey,
  agentExecPermissionKey,
  agentToolPermissionKey,
  authorizeAgentTool,
} from './agent-tool-access.js';
import {
  recordAgentToolAllowedByGrant,
  recordAgentToolDenied,
  recordAgentTrustOutputCapped,
  recordAgentTrustWouldDeny,
} from './agent-tool-audit.js';
import { currentLowTrustMode } from './low-trust-mode.js';
import {
  checkLowTrustScope,
  type LowTrustOwnershipLoader,
  lowTrustOutputExceedsCap,
  maxStringBytes,
} from './low-trust-scope.js';

/**
 * Minimal tool shape (structurally satisfied by `@revealui/ai` Tool).
 * No index signature — keeps `Tool[]` assignable without casts.
 */
export interface GovernableTool {
  name: string;
  execute: (params: unknown) => Promise<unknown>;
}

export interface AgentToolGovernanceContext {
  principal: AgentPrincipal;
  namespace: string;
  sessionId?: string;
  accountId?: string | null;
  userId?: string | null;
  taskId?: string;
  /** Required under low_trust_review enforce. Missing loader fails closed. */
  ownership?: LowTrustOwnershipLoader | null;
}

/**
 * Wrap tools so each execute is pre-authorized. Soft-fail denials do not throw.
 * Preserves extra tool fields via spread; return type stays the input element type.
 */
export function applyAgentToolGovernance<T extends GovernableTool>(
  tools: readonly T[],
  ctx: AgentToolGovernanceContext,
): T[] {
  const { principal } = ctx;
  return tools.map((tool) => {
    const originalExecute = tool.execute.bind(tool);
    return {
      ...tool,
      async execute(params: unknown): Promise<unknown> {
        const decision = authorizeAgentTool(principal, tool.name);
        const mode = currentLowTrustMode();
        const presetActive =
          principal.trust.preset === 'low_trust_review' &&
          mode !== 'off' &&
          !principal.trustResolveFailure;
        const scopeId = principal.trust.scope?.id ?? null;
        const auditCommon = {
          namespace: ctx.namespace,
          sessionId: ctx.sessionId,
          accountId: ctx.accountId,
          userId: ctx.userId,
          agentId: principal.agentId,
          taskId: ctx.taskId,
          scopeId,
          preset: principal.trust.preset,
          principalKind: principal.kind,
          source: principal.trust.sources[0],
        };

        if (decision.wouldDenyReason) {
          try {
            await recordAgentTrustWouldDeny({
              ...auditCommon,
              toolName: tool.name,
              reason: decision.wouldDenyReason,
            });
          } catch {
            // Shadow logging must not block the call.
          }
        }

        if (!decision.allowed) {
          try {
            await recordAgentToolDenied({
              ...auditCommon,
              toolName: tool.name,
              reason: decision.reason,
            });
          } catch {
            // Soft-fail: still return denial if deny-audit fails.
          }
          return {
            success: false,
            error: `Permission denied (${decision.reason}): ${tool.name}`,
          };
        }

        if (decision.reason === 'explicit_grant') {
          const resource =
            decision.class === 'exec'
              ? agentExecPermissionKey(tool.name)
              : decision.class === 'admin-pii'
                ? agentAdminPiiPermissionKey(tool.name)
                : agentToolPermissionKey(tool.name);
          const grant = principalFindGrant(principal, resource, 'execute');
          await recordAgentToolAllowedByGrant({
            ...auditCommon,
            toolName: tool.name,
            className: decision.class,
            grantResource: grant?.resource ?? resource,
            expiresAt: grant?.expiresAt ?? null,
          });
        }

        if (presetActive) {
          const scopeCheck = await checkLowTrustScope({
            toolName: tool.name,
            params,
            trust: principal.trust,
            loader: ctx.ownership ?? null,
          });
          if (!scopeCheck.ok) {
            if (mode === 'shadow') {
              try {
                await recordAgentTrustWouldDeny({
                  ...auditCommon,
                  toolName: tool.name,
                  reason: 'low_trust_out_of_scope',
                });
              } catch {
                // Shadow logging must not block the call.
              }
            } else {
              try {
                await recordAgentToolDenied({
                  ...auditCommon,
                  toolName: tool.name,
                  reason: 'low_trust_out_of_scope',
                });
              } catch {
                // Soft-fail: still return denial if deny-audit fails.
              }
              return {
                success: false,
                error: `Permission denied (low_trust_out_of_scope): ${tool.name}`,
              };
            }
          }

          if (lowTrustOutputExceedsCap(params)) {
            const bytes = maxStringBytes(params);
            const limit = getLowTrustLimits().maxOutputBytes;
            try {
              await recordAgentTrustOutputCapped({ ...auditCommon, bytes, limit });
            } catch (err) {
              if (mode === 'enforce') throw err;
            }
            if (mode === 'enforce') {
              return {
                success: false,
                error: `Permission denied (low_trust_output_too_large): ${tool.name}`,
              };
            }
          }
        }

        const result = await originalExecute(params);
        if (presetActive && lowTrustOutputExceedsCap(result)) {
          const bytes = maxStringBytes(result);
          const limit = getLowTrustLimits().maxOutputBytes;
          try {
            await recordAgentTrustOutputCapped({ ...auditCommon, bytes, limit });
          } catch (err) {
            if (mode === 'enforce') throw err;
          }
          if (mode === 'enforce') {
            return {
              success: false,
              error: `Permission denied (low_trust_output_too_large): ${tool.name}`,
            };
          }
        }
        return result;
      },
    };
  }) as T[];
}
