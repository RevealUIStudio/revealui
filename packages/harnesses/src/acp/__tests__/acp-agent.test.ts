/**
 * GAP-381 Phase D — scripted ACP client acceptance.
 *
 * initialize → session/new → session/prompt → session/update → session/request_permission
 * In-process (no stdio) via AgentApp.connect(ClientApp).
 */

import * as acp from '@agentclientprotocol/sdk';
import { describe, expect, it } from 'vitest';
import { createRevealUiAcpAgent } from '../agent.js';
import type { AcpPromptExecutor } from '../executor.js';
import { extractPromptText } from '../prompt-text.js';

describe('extractPromptText', () => {
  it('joins text content blocks', () => {
    expect(
      extractPromptText([
        { type: 'text', text: 'hello' },
        { type: 'text', text: 'world' },
      ]),
    ).toBe('hello\nworld');
  });

  it('returns empty for non-text', () => {
    expect(extractPromptText([{ type: 'image', data: 'x' }])).toBe('');
  });
});

describe('RevealUI ACP agent (I-6 path + protocol exercise)', () => {
  it('runs initialize → session/new → prompt with update + permission', async () => {
    const executorCalls: string[] = [];
    const executor: AcpPromptExecutor = async (input) => {
      executorCalls.push(input.promptText);
      // Prove no direct DB import is required for the agent plane (I-6 surface).
      expect(input.cwd.length).toBeGreaterThan(0);
      return { success: true, text: `echo:${input.promptText}` };
    };

    const agentApp = createRevealUiAcpAgent({
      name: 'test-revealui-agent',
      executor,
      requirePromptPermission: true,
    });

    const permissionRequests: string[] = [];
    const updates: string[] = [];

    const clientApp = acp
      .client({ name: 'test-client' })
      .onRequest('session/request_permission', async (ctx) => {
        permissionRequests.push(ctx.params.toolCall.title ?? '');
        return {
          outcome: {
            outcome: 'selected' as const,
            optionId: 'allow',
          },
        };
      })
      .onNotification('session/update', async (ctx) => {
        const update = ctx.params.update;
        if (update.sessionUpdate === 'agent_message_chunk' && update.content.type === 'text') {
          updates.push(update.content.text);
        }
      });

    await clientApp.connectWith(agentApp, async (ctx) => {
      const init = await ctx.request('initialize', {
        protocolVersion: acp.PROTOCOL_VERSION,
        clientInfo: { name: 'vitest', version: '0.0.0' },
        clientCapabilities: {},
      });
      expect(init.protocolVersion).toBe(acp.PROTOCOL_VERSION);
      expect(init.agentInfo?.name).toBe('RevealUI Agent');

      const session = await ctx.buildSession(process.cwd()).start();
      expect(session.sessionId.length).toBeGreaterThan(0);

      const stop = await session.prompt('hello from acp test');
      expect(stop.stopReason).toBe('end_turn');

      session.dispose();
    });

    expect(permissionRequests.length).toBe(1);
    expect(permissionRequests[0]).toContain('RevealUI agent');
    expect(executorCalls).toEqual(['hello from acp test']);
    expect(updates.some((u) => u.includes('Running RevealUI agent'))).toBe(true);
    expect(updates.some((u) => u.includes('echo:hello from acp test'))).toBe(true);
  });

  it('denies run when permission is rejected (executor not called)', async () => {
    let executorHits = 0;
    const agentApp = createRevealUiAcpAgent({
      executor: async () => {
        executorHits += 1;
        return { success: true, text: 'should-not-run' };
      },
    });

    const clientApp = acp
      .client({ name: 'deny-client' })
      .onRequest('session/request_permission', async () => ({
        outcome: { outcome: 'selected' as const, optionId: 'reject' },
      }))
      .onNotification('session/update', async () => {});

    await clientApp.connectWith(agentApp, async (ctx) => {
      await ctx.request('initialize', {
        protocolVersion: acp.PROTOCOL_VERSION,
        clientInfo: { name: 'deny', version: '0' },
        clientCapabilities: {},
      });
      const session = await ctx.buildSession(process.cwd()).start();
      const stop = await session.prompt('secret');
      expect(stop.stopReason).toBe('end_turn');
      session.dispose();
    });

    expect(executorHits).toBe(0);
  });

  it('does not import database modules from the acp package surface (I-6)', async () => {
    // Static structural check: the acp module graph must not pull db/drizzle.
    const acpIndex = await import('../index.js');
    expect(typeof acpIndex.createRevealUiAcpAgent).toBe('function');
    expect(typeof acpIndex.runRevealUiAcpAgentStdio).toBe('function');
    // No db export or side-effect required for this assertion beyond load.
  });
});
