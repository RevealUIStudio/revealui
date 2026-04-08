/**
 * Vector Clock for causal ordering across distributed nodes.
 *
 * A vector clock is a mechanism for tracking causality in distributed systems.
 * Each node maintains a counter, and the clock can determine if one event
 * happened before, after, or concurrently with another event.
 *
 * @example
 * ```typescript
 * const clock1 = new VectorClock('node-a')
 * clock1.tick('node-a') // { 'node-a': 1 }
 *
 * const clock2 = new VectorClock('node-b')
 * clock2.tick('node-b') // { 'node-b': 1 }
 *
 * // Concurrent events
 * clock1.compare(clock2) // 'concurrent'
 *
 * // After merge
 * clock1.merge(clock2)
 * clock1.tick('node-a')
 * clock1.compare(clock2) // 'after'
 * ```
 */

export interface VectorClockData {
  clock: Record<string, number>;
}

export type VectorClockComparison = 'before' | 'after' | 'concurrent' | 'equal';

export class VectorClock {
  private clock: Map<string, number>;
  private nodeId: string;

  /**
   * Creates a new VectorClock instance.
   * @param nodeId - Unique identifier for this node
   */
  constructor(nodeId: string) {
    this.nodeId = nodeId;
    this.clock = new Map();
    this.clock.set(nodeId, 0);
  }

  /**
   * Increments the clock for a specific node.
   * Typically called when this node performs an operation.
   * @param nodeId - The node ID to increment (defaults to this node)
   */
  tick(nodeId?: string): void {
    const id = nodeId ?? this.nodeId;
    const current = this.clock.get(id) ?? 0;
    this.clock.set(id, current + 1);
  }

  /**
   * Gets the current timestamp for a specific node.
   * @param nodeId - The node ID to query
   * @returns The current timestamp for the node, or 0 if not present
   */
  get(nodeId: string): number {
    return this.clock.get(nodeId) ?? 0;
  }

  /**
   * Gets the timestamp for this node.
   * @returns The current timestamp for this node
   */
  getLocal(): number {
    return this.get(this.nodeId);
  }

  /**
   * Merges another vector clock into this one.
   * Takes the maximum of each node's counter.
   * @param other - The vector clock to merge
   */
  merge(other: VectorClock): void {
    for (const [nodeId, timestamp] of other.clock) {
      const current = this.clock.get(nodeId) ?? 0;
      this.clock.set(nodeId, Math.max(current, timestamp));
    }
  }

  /**
   * Compares this vector clock with another.
   * @param other - The vector clock to compare against
   * @returns The comparison result:
   *   - 'before': this happened before other
   *   - 'after': this happened after other
   *   - 'concurrent': events are concurrent (no causal relationship)
   *   - 'equal': clocks are identical
   */
  compare(other: VectorClock): VectorClockComparison {
    let lessThan = false;
    let greaterThan = false;

    // Get all unique node IDs
    const allNodes = new Set([...this.clock.keys(), ...other.clock.keys()]);

    for (const nodeId of allNodes) {
      const thisValue = this.clock.get(nodeId) ?? 0;
      const otherValue = other.clock.get(nodeId) ?? 0;

      if (thisValue < otherValue) {
        lessThan = true;
      }
      if (thisValue > otherValue) {
        greaterThan = true;
      }
    }

    if (lessThan && greaterThan) {
      return 'concurrent';
    }
    if (lessThan) {
      return 'before';
    }
    if (greaterThan) {
      return 'after';
    }
    return 'equal';
  }

  /**
   * Checks if this clock happened before another.
   * @param other - The vector clock to compare against
   */
  happenedBefore(other: VectorClock): boolean {
    return this.compare(other) === 'before';
  }

  /**
   * Checks if this clock happened after another.
   * @param other - The vector clock to compare against
   */
  happenedAfter(other: VectorClock): boolean {
    return this.compare(other) === 'after';
  }

  /**
   * Checks if this clock is concurrent with another.
   * @param other - The vector clock to compare against
   */
  isConcurrent(other: VectorClock): boolean {
    return this.compare(other) === 'concurrent';
  }

  /**
   * Creates a copy of this vector clock.
   * @returns A new VectorClock with the same state
   */
  clone(): VectorClock {
    const cloned = new VectorClock(this.nodeId);
    cloned.clock = new Map(this.clock);
    return cloned;
  }

  /**
   * Serializes the vector clock to a plain object.
   * @returns A serializable representation of the clock
   */
  toData(): VectorClockData {
    return {
      clock: Object.fromEntries(this.clock),
    };
  }

  /**
   * Deserializes a vector clock from serialized data.
   * @param data - The serialized clock data
   * @param nodeId - The node ID for the new clock instance
   * @returns A new VectorClock instance
   */
  static fromData(data: VectorClockData, nodeId: string): VectorClock {
    const clock = new VectorClock(nodeId);
    clock.clock = new Map(Object.entries(data.clock));
    return clock;
  }

  /**
   * Gets the total number of nodes tracked by this clock.
   */
  get size(): number {
    return this.clock.size;
  }

  /**
   * Gets all node IDs tracked by this clock.
   */
  get nodes(): string[] {
    return Array.from(this.clock.keys());
  }

  /**
   * Returns a string representation for debugging.
   */
  toString(): string {
    const entries = Array.from(this.clock.entries())
      .map(([k, v]) => `${k}:${v}`)
      .join(', ');
    return `VectorClock(${entries})`;
  }
}
