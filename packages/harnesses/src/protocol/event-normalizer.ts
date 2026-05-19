/**
 * Event Normalization Layer
 *
 * Translates HarnessEvent -> ProtocolEventEnvelope, applying
 * degradation strategies for events the tool cannot emit natively.
 */

import type { HarnessEvent } from '../types/core.js';
import type { DegradationStrategy } from './degradation-strategies.js';
import { getDegradationStrategy } from './degradation-strategies.js';
import type { ProtocolEvent, ProtocolEventEnvelope } from './event-envelope.js';
import { createEventEnvelope } from './event-envelope.js';

/** Result of normalizing a HarnessEvent. */
export interface NormalizedEvent {
  envelope: ProtocolEventEnvelope;
  /** Undefined when the tool natively supports the event. */
  degradation: DegradationStrategy | undefined;
}

/**
 * Translates tool-native HarnessEvents into canonical protocol event envelopes.
 *
 * Each instance is bound to a specific tool/agent/session identity.
 * Call `normalize()` with each HarnessEvent to get a ProtocolEventEnvelope.
 */
export class EventNormalizer {
  constructor(
    private readonly toolName: string,
    private readonly agentId: string,
    private readonly sessionId: string,
  ) {}

  /**
   * Map a HarnessEvent type to its canonical protocol event.
   * Returns null if the event has no protocol mapping.
   */
  private mapEventType(event: HarnessEvent): ProtocolEvent | null {
    switch (event.type) {
      case 'harness-connected':
        return 'session.start';
      case 'harness-disconnected':
        return 'session.stop';
      case 'generation-started':
        return 'tool.before';
      case 'generation-completed':
        return 'tool.after';
      case 'error':
        return 'session.crash';
      default:
        return null;
    }
  }

  /** Extract event-specific payload fields. */
  private extractPayload(event: HarnessEvent): Record<string, unknown> {
    switch (event.type) {
      case 'harness-connected':
        return { harnessId: event.harnessId };
      case 'harness-disconnected':
        return { harnessId: event.harnessId };
      case 'generation-started':
        return { taskId: event.taskId };
      case 'generation-completed':
        return { taskId: event.taskId, output: event.output };
      case 'error':
        return { harnessId: event.harnessId, message: event.message };
      default:
        return {};
    }
  }

  /**
   * Normalize a HarnessEvent into a ProtocolEventEnvelope.
   *
   * Returns null if:
   * - The event has no protocol mapping
   * - The degradation strategy for this tool/event is 'absent'
   */
  normalize(event: HarnessEvent): NormalizedEvent | null {
    const protocolEvent = this.mapEventType(event);
    if (!protocolEvent) return null;

    const degradation = getDegradationStrategy(this.toolName, protocolEvent);

    // Absent means no meaningful approximation exists; skip the event
    if (degradation === 'absent') return null;

    const payload = this.extractPayload(event);
    if (degradation) {
      payload.degraded = true;
      payload.degradationStrategy = degradation;
    }

    const envelope = createEventEnvelope(
      protocolEvent,
      this.agentId,
      this.toolName,
      this.sessionId,
      payload,
    );

    return { envelope, degradation };
  }

  /** Convenience: normalize and return just the envelope (or null). */
  normalizeToEnvelope(event: HarnessEvent): ProtocolEventEnvelope | null {
    return this.normalize(event)?.envelope ?? null;
  }
}
