/**
 * Observed-Removed Set (OR-Set)
 *
 * A CRDT that supports both add and remove operations on a set.
 * Uses unique tags for each element addition to handle concurrent operations.
 *
 * Use cases:
 * - Collections of memories
 * - Tags and categories
 * - Active agent lists
 * - User sessions
 *
 * @example
 * ```typescript
 * const set1 = new ORSet<string>('node-a')
 * const set2 = new ORSet<string>('node-b')
 *
 * set1.add('item1')
 * set2.add('item2')
 * set1.remove('item1')
 *
 * const merged = set1.merge(set2)
 * merged.values() // ['item2']
 * ```
 */

import { randomUUID } from 'node:crypto';
import { VectorClock, type VectorClockData } from './vector-clock.js';

export interface ORSetEntry<T> {
  value: T;
  tag: string;
  clock: VectorClockData;
}

export interface ORSetData<T> {
  nodeId: string;
  added: Record<string, ORSetEntry<T>>;
  removed: string[];
}

export class ORSet<T> {
  private nodeId: string;
  private added: Map<string, { value: T; clock: VectorClock }>;
  private removed: Set<string>;
  private clock: VectorClock;

  /**
   * Creates a new OR-Set.
   * @param nodeId - Unique identifier for this node
   */
  constructor(nodeId: string) {
    this.nodeId = nodeId;
    this.added = new Map();
    this.removed = new Set();
    this.clock = new VectorClock(nodeId);
  }

  /**
   * Adds an element to the set.
   * @param element - The element to add
   * @returns The unique tag for this addition
   */
  add(element: T): string {
    const tag = `${this.nodeId}:${randomUUID()}`;
    this.clock.tick();
    this.added.set(tag, {
      value: element,
      clock: this.clock.clone(),
    });
    return tag;
  }

  /**
   * Removes an element by its tag.
   * @param tag - The unique tag of the element to remove
   * @returns true if the element was removed
   */
  remove(tag: string): boolean {
    if (this.added.has(tag) && !this.removed.has(tag)) {
      this.removed.add(tag);
      this.clock.tick();
      return true;
    }
    return false;
  }

  /**
   * Removes an element by value (removes all instances).
   * @param element - The element value to remove
   * @returns Number of instances removed
   */
  removeByValue(element: T): number {
    let count = 0;
    for (const [tag, entry] of this.added) {
      if (this.deepEquals(entry.value, element) && !this.removed.has(tag)) {
        this.removed.add(tag);
        count++;
      }
    }
    if (count > 0) {
      this.clock.tick();
    }
    return count;
  }

  /**
   * Checks if a tag is in the set.
   * @param tag - The unique tag to check
   * @returns true if the tag exists and hasn't been removed
   */
  has(tag: string): boolean {
    return this.added.has(tag) && !this.removed.has(tag);
  }

  /**
   * Checks if a value exists in the set.
   * @param element - The element value to check
   * @returns true if the value exists
   */
  hasValue(element: T): boolean {
    for (const [tag, entry] of this.added) {
      if (this.deepEquals(entry.value, element) && !this.removed.has(tag)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Gets all tags for a given value.
   * @param element - The element value to find tags for
   * @returns Array of tags for the value
   */
  getTags(element: T): string[] {
    const tags: string[] = [];
    for (const [tag, entry] of this.added) {
      if (this.deepEquals(entry.value, element) && !this.removed.has(tag)) {
        tags.push(tag);
      }
    }
    return tags;
  }

  /**
   * Gets all current values in the set.
   * @returns Array of all non-removed values
   */
  values(): T[] {
    const values: T[] = [];
    for (const [tag, entry] of this.added) {
      if (!this.removed.has(tag)) {
        values.push(entry.value);
      }
    }
    return values;
  }

  /**
   * Gets all entries (with tags) in the set.
   * @returns Array of [tag, value] tuples
   */
  entries(): Array<[string, T]> {
    const entries: Array<[string, T]> = [];
    for (const [tag, entry] of this.added) {
      if (!this.removed.has(tag)) {
        entries.push([tag, entry.value]);
      }
    }
    return entries;
  }

  /**
   * Gets the number of elements in the set.
   */
  get size(): number {
    let count = 0;
    for (const tag of this.added.keys()) {
      if (!this.removed.has(tag)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Checks if the set is empty.
   */
  get isEmpty(): boolean {
    return this.size === 0;
  }

  /**
   * Merges another OR-Set into this one.
   * @param other - The set to merge
   * @returns A new merged ORSet
   */
  merge(other: ORSet<T>): ORSet<T> {
    const merged = new ORSet<T>(this.nodeId);

    // Merge clocks
    merged.clock = this.clock.clone();
    merged.clock.merge(other.clock);

    // Union of added elements
    for (const [tag, entry] of this.added) {
      merged.added.set(tag, {
        value: entry.value,
        clock: entry.clock.clone(),
      });
    }
    for (const [tag, entry] of other.added) {
      if (!merged.added.has(tag)) {
        merged.added.set(tag, {
          value: entry.value,
          clock: entry.clock.clone(),
        });
      }
    }

    // Union of removed tags
    for (const tag of this.removed) {
      merged.removed.add(tag);
    }
    for (const tag of other.removed) {
      merged.removed.add(tag);
    }

    return merged;
  }

  /**
   * Removes tombstones — entries in `added` whose tag appears in `removed`.
   * Reduces memory usage and serialization size. Safe to call after all peers
   * have merged the corresponding remove operations.
   *
   * @returns Number of tombstones compacted
   */
  compact(): number {
    let count = 0;
    for (const tag of this.removed) {
      if (this.added.has(tag)) {
        this.added.delete(tag);
        count++;
      }
    }
    // Clear the removed set — all tombstones have been applied
    if (count > 0) {
      this.removed.clear();
    }
    return count;
  }

  /**
   * Number of tombstones (removed tags still tracked).
   */
  get tombstoneCount(): number {
    return this.removed.size;
  }

  /**
   * Clears all elements from the set.
   */
  clear(): void {
    for (const tag of this.added.keys()) {
      this.removed.add(tag);
    }
    this.clock.tick();
  }

  /**
   * Creates a copy of this set.
   * @returns A new ORSet with the same state
   */
  clone(): ORSet<T> {
    const cloned = new ORSet<T>(this.nodeId);
    cloned.clock = this.clock.clone();

    for (const [tag, entry] of this.added) {
      cloned.added.set(tag, {
        value: entry.value,
        clock: entry.clock.clone(),
      });
    }

    for (const tag of this.removed) {
      cloned.removed.add(tag);
    }

    return cloned;
  }

  /**
   * Serializes the set to a plain object.
   * @returns A serializable representation
   */
  toData(): ORSetData<T> {
    const added: Record<string, ORSetEntry<T>> = {};

    for (const [tag, entry] of this.added) {
      added[tag] = {
        value: entry.value,
        tag,
        clock: entry.clock.toData(),
      };
    }

    return {
      nodeId: this.nodeId,
      added,
      removed: Array.from(this.removed),
    };
  }

  /**
   * Deserializes a set from serialized data.
   * @param data - The serialized set data
   * @returns A new ORSet instance
   */
  static fromData<T>(data: ORSetData<T>): ORSet<T> {
    const set = new ORSet<T>(data.nodeId);

    for (const [tag, entry] of Object.entries(data.added)) {
      set.added.set(tag, {
        value: entry.value,
        clock: VectorClock.fromData(entry.clock, data.nodeId),
      });
    }

    for (const tag of data.removed) {
      set.removed.add(tag);
    }

    return set;
  }

  /**
   * Creates a new OR-Set with a generated node ID.
   * @returns A new ORSet with a UUID node ID
   */
  static create<T>(): ORSet<T> {
    return new ORSet<T>(randomUUID());
  }

  /**
   * Deep equality check for complex objects.
   */
  private deepEquals(a: T, b: T): boolean {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (typeof a !== 'object' || a === null) return false;

    return JSON.stringify(a) === JSON.stringify(b);
  }

  /**
   * Returns a string representation for debugging.
   */
  toString(): string {
    const values = this.values();
    return `ORSet(size=${this.size}, values=[${values.map((v) => JSON.stringify(v)).join(', ')}])`;
  }
}
