/**
 * Harness Protocol Lifecycle Events
 *
 * Defines the 10 canonical lifecycle events, the event envelope,
 * Zod schemas for runtime validation, and a factory function.
 *
 * Note: of the 10 canonical events, 5 currently have emit paths from
 * HarnessEvent in the event normalizer (session.start, session.stop,
 * tool.before, tool.after, session.crash). The remaining 5 are defined
 * here for future emit paths and for adapters that produce them directly.
 */

import { z } from 'zod';

/** Protocol version. */
export const PROTOCOL_VERSION = '0.1.0' as const;

/** The 10 canonical protocol lifecycle events. */
export type ProtocolEvent =
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
export const PROTOCOL_EVENTS: readonly ProtocolEvent[] = [
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

/** Standard envelope wrapping every protocol event. */
export interface ProtocolEventEnvelope {
  version: typeof PROTOCOL_VERSION;
  event: ProtocolEvent;
  timestamp: string;
  agentId: string;
  toolName: string;
  sessionId: string;
  payload: Record<string, unknown>;
}

/** Zod schema for runtime validation of event envelopes. */
export const protocolEventSchema = z.enum([
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

export const protocolEventEnvelopeSchema = z.object({
  version: z.literal(PROTOCOL_VERSION),
  event: protocolEventSchema,
  timestamp: z.string().min(1),
  agentId: z.string().min(1),
  toolName: z.string().min(1),
  sessionId: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
});

/** Creates a ProtocolEventEnvelope with the current timestamp. */
export function createEventEnvelope(
  event: ProtocolEvent,
  agentId: string,
  toolName: string,
  sessionId: string,
  payload: Record<string, unknown> = {},
): ProtocolEventEnvelope {
  return {
    version: PROTOCOL_VERSION,
    event,
    timestamp: new Date().toISOString(),
    agentId,
    toolName,
    sessionId,
    payload,
  };
}
