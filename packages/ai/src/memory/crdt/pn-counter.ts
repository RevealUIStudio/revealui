import { randomUUID } from 'node:crypto';
/**
 * Positive-Negative Counter (PN-Counter)
 *
 * A CRDT counter that supports both increment and decrement operations.
 * Uses two G-Counters (grow-only counters) internally: one for increments
 * and one for decrements.
 *
 * Use cases:
 * - Access counts
 * - Usage metrics
 * - Voting systems
 * - Inventory tracking
 *
 * @example
 * ```typescript
 * const counter1 = new PNCounter('node-a')
 * const counter2 = new PNCounter('node-b')
 *
 * counter1.increment(5)
 * counter2.increment(3)
 * counter2.decrement(2)
 *
 * const merged = counter1.merge(counter2)
 * const total = merged.value() // 6 (5 + 3 - 2)
 * ```
 */

export interface PNCounterData {
  nodeId: string;
  increments: Record<string, number>;
  decrements: Record<string, number>;
}

export class PNCounter {
  private nodeId: string;
  private increments: Map<string, number>;
  private decrements: Map<string, number>;

  /**
   * Creates a new PN-Counter.
   * @param nodeId - Unique identifier for this node
   */
  constructor(nodeId: string) {
    this.nodeId = nodeId;
    this.increments = new Map();
    this.decrements = new Map();

    // Initialize this node's counters
    this.increments.set(nodeId, 0);
    this.decrements.set(nodeId, 0);
  }

  /**
   * Increments the counter.
   * @param delta - Amount to increment by (default: 1)
   */
  increment(delta: number = 1): void {
    if (delta < 0) {
      throw new Error('Increment delta must be non-negative. Use decrement for negative values.');
    }
    const current = this.increments.get(this.nodeId) ?? 0;
    this.increments.set(this.nodeId, current + delta);
  }

  /**
   * Decrements the counter.
   * @param delta - Amount to decrement by (default: 1)
   */
  decrement(delta: number = 1): void {
    if (delta < 0) {
      throw new Error('Decrement delta must be non-negative. Use increment for negative values.');
    }
    const current = this.decrements.get(this.nodeId) ?? 0;
    this.decrements.set(this.nodeId, current + delta);
  }

  /**
   * Gets the current value of the counter.
   * @returns The sum of all increments minus the sum of all decrements
   */
  value(): number {
    let total = 0;

    for (const inc of this.increments.values()) {
      total += inc;
    }
    for (const dec of this.decrements.values()) {
      total -= dec;
    }

    return total;
  }

  /**
   * Gets the total increment count.
   */
  totalIncrements(): number {
    let total = 0;
    for (const inc of this.increments.values()) {
      total += inc;
    }
    return total;
  }

  /**
   * Gets the total decrement count.
   */
  totalDecrements(): number {
    let total = 0;
    for (const dec of this.decrements.values()) {
      total += dec;
    }
    return total;
  }

  /**
   * Gets the increment count for a specific node.
   * @param nodeId - The node ID to query
   */
  getIncrement(nodeId: string): number {
    return this.increments.get(nodeId) ?? 0;
  }

  /**
   * Gets the decrement count for a specific node.
   * @param nodeId - The node ID to query
   */
  getDecrement(nodeId: string): number {
    return this.decrements.get(nodeId) ?? 0;
  }

  /**
   * Merges another PN-Counter into this one.
   * Takes the maximum of each node's counters.
   * @param other - The counter to merge
   * @returns A new merged PNCounter
   */
  merge(other: PNCounter): PNCounter {
    const merged = new PNCounter(this.nodeId);

    // Get all unique node IDs
    const allNodes = new Set([
      ...this.increments.keys(),
      ...this.decrements.keys(),
      ...other.increments.keys(),
      ...other.decrements.keys(),
    ]);

    for (const nodeId of allNodes) {
      // Max of increments
      const thisInc = this.increments.get(nodeId) ?? 0;
      const otherInc = other.increments.get(nodeId) ?? 0;
      merged.increments.set(nodeId, Math.max(thisInc, otherInc));

      // Max of decrements
      const thisDec = this.decrements.get(nodeId) ?? 0;
      const otherDec = other.decrements.get(nodeId) ?? 0;
      merged.decrements.set(nodeId, Math.max(thisDec, otherDec));
    }

    return merged;
  }

  /**
   * Resets this node's counters to zero.
   * Note: This doesn't affect the overall value if other nodes have contributions.
   */
  reset(): void {
    this.increments.set(this.nodeId, 0);
    this.decrements.set(this.nodeId, 0);
  }

  /**
   * Creates a copy of this counter.
   * @returns A new PNCounter with the same state
   */
  clone(): PNCounter {
    const cloned = new PNCounter(this.nodeId);
    cloned.increments = new Map(this.increments);
    cloned.decrements = new Map(this.decrements);
    return cloned;
  }

  /**
   * Serializes the counter to a plain object.
   * @returns A serializable representation
   */
  toData(): PNCounterData {
    return {
      nodeId: this.nodeId,
      increments: Object.fromEntries(this.increments),
      decrements: Object.fromEntries(this.decrements),
    };
  }

  /**
   * Deserializes a counter from serialized data.
   * @param data - The serialized counter data
   * @returns A new PNCounter instance
   */
  static fromData(data: PNCounterData): PNCounter {
    const counter = new PNCounter(data.nodeId);
    counter.increments = new Map(Object.entries(data.increments));
    counter.decrements = new Map(Object.entries(data.decrements));
    return counter;
  }

  /**
   * Creates a new counter with a generated node ID.
   * @returns A new PNCounter with a UUID node ID
   */
  static create(): PNCounter {
    return new PNCounter(randomUUID());
  }

  /**
   * Gets all contributing node IDs.
   */
  get nodes(): string[] {
    return Array.from(new Set([...this.increments.keys(), ...this.decrements.keys()]));
  }

  /**
   * Returns a string representation for debugging.
   */
  toString(): string {
    return `PNCounter(value=${this.value()}, inc=${this.totalIncrements()}, dec=${this.totalDecrements()})`;
  }
}
