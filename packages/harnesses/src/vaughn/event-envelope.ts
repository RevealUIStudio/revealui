/**
 * VAUGHN Lifecycle Events (Section 5 of VAUGHN.md)
 *
 * Defines the 10 canonical lifecycle events, the event envelope,
 * Zod schemas for runtime validation, and a factory function.
 */

import { z } from 'zod';

/** Protocol version. */
export const VAUGHN_VERSION = '0.1.0' as const;

/** The 10 canonical VAUGHN lifecycle events. */
export type VaughnEvent =
  | 'session.start'
  | 'session.stop'
  | 'session.crash'
  | 'prompt.submit'
  | 'tool.before'
  | 'tool.after'
  | 'tool.blocked'
  | 'task.claimed'
  | 'task.completed'
  | 'agent.heartbeat';

/** All valid event names as a readonly array. */
export const VAUGHN_EVENTS: readonly VaughnEvent[] = [
  'session.start',
  'session.stop',
  'session.crash',
  'prompt.submit',
  'tool.before',
  'tool.after',
  'tool.blocked',
  'task.claimed',
  'task.completed',
  'agent.heartbeat',
] as const;

/** Standard envelope wrapping every VAUGHN event (Section 5.4). */
export interface VaughnEventEnvelope {
  version: typeof VAUGHN_VERSION;
  event: VaughnEvent;
  timestamp: string;
  agentId: string;
  toolName: string;
  sessionId: string;
  payload: Record<string, unknown>;
}

/** Zod schema for runtime validation of event envelopes. */
export const vaughnEventSchema = z.enum([
  'session.start',
  'session.stop',
  'session.crash',
  'prompt.submit',
  'tool.before',
  'tool.after',
  'tool.blocked',
  'task.claimed',
  'task.completed',
  'agent.heartbeat',
]);

export const vaughnEventEnvelopeSchema = z.object({
  version: z.literal(VAUGHN_VERSION),
  event: vaughnEventSchema,
  timestamp: z.string().min(1),
  agentId: z.string().min(1),
  toolName: z.string().min(1),
  sessionId: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
});

/** Creates a VaughnEventEnvelope with the current timestamp. */
export function createEventEnvelope(
  event: VaughnEvent,
  agentId: string,
  toolName: string,
  sessionId: string,
  payload: Record<string, unknown> = {},
): VaughnEventEnvelope {
  return {
    version: VAUGHN_VERSION,
    event,
    timestamp: new Date().toISOString(),
    agentId,
    toolName,
    sessionId,
    payload,
  };
}
