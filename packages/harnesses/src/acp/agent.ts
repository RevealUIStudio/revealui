/**
 * RevealUI ACP agent app (GAP-381 Phase D).
 *
 * Uses official @agentclientprotocol/sdk (ADR 2026-08-08-gap-381-acp-sdk-posture).
 * Protocol: ACP v1 over ndjson (stdio or in-process Stream).
 *
 * Invariants:
 * - I-1: clientInfo / editor identity is display metadata only
 * - I-6: prompt execution uses AcpPromptExecutor (adapter), never direct DB
 */

import { randomBytes } from 'node:crypto';
import * as acp from '@agentclientprotocol/sdk';
import type { AcpPromptExecutor } from './executor.js';
import { createDefaultAcpPromptExecutor } from './executor.js';
import { extractPromptText } from './prompt-text.js';

export interface RevealUiAcpAgentOptions {
  /** Human-readable app name for diagnostics. */
  name?: string;
  /** Prompt runner (default: RevealUIAgentAdapter). */
  executor?: AcpPromptExecutor;
  /**
   * When true (default), every prompt turn asks the client for permission
   * before running the executor. Required for the Phase D acceptance path
   * that exercises session/request_permission.
   */
  requirePromptPermission?: boolean;
}

interface SessionState {
  cwd: string;
  /** Display-only client metadata (I-1: never used for auth). */
  clientLabel: string;
  pendingPrompt: AbortController | null;
}

function newSessionId(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Build a configured AgentApp. Caller connects a Stream (stdio or test).
 */
export function createRevealUiAcpAgent(options: RevealUiAcpAgentOptions = {}): acp.AgentApp {
  const sessions = new Map<string, SessionState>();
  const executor = options.executor ?? createDefaultAcpPromptExecutor();
  const requirePromptPermission = options.requirePromptPermission !== false;
  let displayClientLabel = 'acp-client';

  const app = acp
    .agent({ name: options.name ?? 'revealui-agent' })
    .onRequest('initialize', async (ctx) => {
      const clientInfo = ctx.params.clientInfo;
      if (clientInfo && typeof clientInfo === 'object') {
        const name = 'name' in clientInfo ? String(clientInfo.name ?? '') : '';
        const version = 'version' in clientInfo ? String(clientInfo.version ?? '') : '';
        displayClientLabel =
          [name, version].filter((part) => part.length > 0).join('@') || 'acp-client';
      }
      return {
        protocolVersion: acp.PROTOCOL_VERSION,
        agentCapabilities: {
          loadSession: false,
        },
        agentInfo: {
          name: 'RevealUI Agent',
          version: '0.1.0',
        },
      };
    })
    .onRequest('authenticate', async () => {
      // Device-token / BYOK auth is outside ACP wire for Phase D; empty OK.
      return {};
    })
    .onRequest('session/new', async (ctx) => {
      const sessionId = newSessionId();
      const cwd =
        typeof ctx.params.cwd === 'string' && ctx.params.cwd.length > 0
          ? ctx.params.cwd
          : process.cwd();
      sessions.set(sessionId, {
        cwd,
        clientLabel: displayClientLabel,
        pendingPrompt: null,
      });
      return { sessionId };
    })
    .onRequest('session/prompt', async (ctx) => {
      const session = sessions.get(ctx.params.sessionId);
      if (!session) {
        throw new Error(`Unknown session ${ctx.params.sessionId}`);
      }

      session.pendingPrompt?.abort();
      const abort = new AbortController();
      session.pendingPrompt = abort;

      const promptText = extractPromptText(ctx.params.prompt);
      const signal = abort.signal;

      try {
        if (requirePromptPermission) {
          const permission = await ctx.client.request(
            acp.methods.client.session.requestPermission,
            {
              sessionId: ctx.params.sessionId,
              toolCall: {
                toolCallId: `prompt-${ctx.params.sessionId.slice(0, 8)}`,
                title: 'Run RevealUI agent on this prompt',
                kind: 'execute',
                status: 'pending',
                rawInput: {
                  // clientLabel is display-only (I-1); included for editor UX.
                  clientLabel: session.clientLabel,
                  promptPreview: promptText.slice(0, 200),
                },
              },
              options: [
                {
                  kind: 'allow_once',
                  name: 'Allow this run',
                  optionId: 'allow',
                },
                {
                  kind: 'reject_once',
                  name: 'Deny this run',
                  optionId: 'reject',
                },
              ],
            },
          );

          if (permission.outcome.outcome === 'cancelled') {
            return { stopReason: 'cancelled' as const };
          }
          if (
            permission.outcome.outcome === 'selected' &&
            permission.outcome.optionId === 'reject'
          ) {
            await ctx.client.notify(acp.methods.client.session.update, {
              sessionId: ctx.params.sessionId,
              update: {
                sessionUpdate: 'agent_message_chunk',
                content: {
                  type: 'text',
                  text: 'Run denied by the client.',
                },
              },
            });
            return { stopReason: 'end_turn' as const };
          }
        }

        if (signal.aborted) {
          return { stopReason: 'cancelled' as const };
        }

        await ctx.client.notify(acp.methods.client.session.update, {
          sessionId: ctx.params.sessionId,
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: {
              type: 'text',
              text: 'Running RevealUI agent…',
            },
          },
        });

        const result = await executor({
          sessionId: ctx.params.sessionId,
          promptText,
          cwd: session.cwd,
          signal,
        });

        if (signal.aborted) {
          return { stopReason: 'cancelled' as const };
        }

        await ctx.client.notify(acp.methods.client.session.update, {
          sessionId: ctx.params.sessionId,
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: {
              type: 'text',
              text: result.text,
            },
          },
        });

        return { stopReason: 'end_turn' as const };
      } catch (err) {
        if (signal.aborted) {
          return { stopReason: 'cancelled' as const };
        }
        throw err;
      } finally {
        if (session.pendingPrompt === abort) {
          session.pendingPrompt = null;
        }
      }
    })
    .onNotification('session/cancel', async (ctx) => {
      sessions.get(ctx.params.sessionId)?.pendingPrompt?.abort();
    });

  return app;
}

/** Re-export stream helpers for CLI / tests. */
export { acp };
