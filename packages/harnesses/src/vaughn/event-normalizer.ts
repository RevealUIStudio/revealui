/**
 * VAUGHN Event Normalization Layer
 *
 * Translates HarnessEvent -> VaughnEventEnvelope, applying
 * degradation strategies for events the tool cannot emit natively.
 */

import type { HarnessEvent } from '../types/core.js';
import type { DegradationStrategy } from './degradation-strategies.js';
import { getDegradationStrategy } from './degradation-strategies.js';
import type { VaughnEvent, VaughnEventEnvelope } from './event-envelope.js';
import { createEventEnvelope } from './event-envelope.js';

/** Result of normalizing a HarnessEvent. */
export interface NormalizedEvent {
  envelope: VaughnEventEnvelope;
  /** Undefined when the tool natively supports the event. */
  degradation: DegradationStrategy | undefined;
}

/**
 * Translates tool-native HarnessEvents into VAUGHN canonical event envelopes.
 *
 * Each instance is bound to a specific tool/agent/session identity.
 * Call `normalize()` with each HarnessEvent to get a VaughnEventEnvelope.
 */
export class VaughnEventNormalizer {
  constructor(
    private readonly toolName: string,
    private readonly agentId: string,
    private readonly sessionId: string,
  ) {}

  /**
   * Map a HarnessEvent type to its canonical VAUGHN event.
   * Returns null if the event has no VAUGHN mapping.
   */
  private mapEventType(event: HarnessEvent): VaughnEvent | null {
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
   * Normalize a HarnessEvent into a VaughnEventEnvelope.
   *
   * Returns null if:
   * - The event has no VAUGHN mapping
   * - The degradation strategy for this tool/event is 'absent'
   */
  normalize(event: HarnessEvent): NormalizedEvent | null {
    const vaughnEvent = this.mapEventType(event);
    if (!vaughnEvent) return null;

    const degradation = getDegradationStrategy(this.toolName, vaughnEvent);

    // Absent means no meaningful approximation exists; skip the event
    if (degradation === 'absent') return null;

    const payload = this.extractPayload(event);
    if (degradation) {
      payload.degraded = true;
      payload.degradationStrategy = degradation;
    }

    const envelope = createEventEnvelope(
      vaughnEvent,
      this.agentId,
      this.toolName,
      this.sessionId,
      payload,
    );

    return { envelope, degradation };
  }

  /** Convenience: normalize and return just the envelope (or null). */
  normalizeToEnvelope(event: HarnessEvent): VaughnEventEnvelope | null {
    return this.normalize(event)?.envelope ?? null;
  }
}
