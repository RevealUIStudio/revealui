/**
 * Last-Writer-Wins Register (LWW-Register)
 *
 * A CRDT that stores a single value where the most recent write wins.
 * Uses timestamps and node IDs to determine ordering when timestamps are equal.
 *
 * Use cases:
 * - User preferences
 * - Agent configurations
 * - Any single-valued state
 *
 * @example
 * ```typescript
 * const reg1 = new LWWRegister<string>('node-a', 'initial')
 * const reg2 = new LWWRegister<string>('node-b', 'initial')
 *
 * reg1.set('value-from-a')
 * reg2.set('value-from-b')
 *
 * // Merge resolves to most recent write
 * const merged = reg1.merge(reg2)
 * console.log(merged.get()) // 'value-from-b' (if reg2 was set later)
 * ```
 */

import { v4 as uuidv4 } from 'uuid'

export interface LWWRegisterData<T> {
  value: T
  timestamp: number
  nodeId: string
  version: number
}

export class LWWRegister<T> {
  private value: T
  private timestamp: number
  private nodeId: string
  private version: number

  /**
   * Creates a new LWW-Register.
   * @param nodeId - Unique identifier for this node
   * @param initialValue - The initial value
   * @param timestamp - Optional initial timestamp (defaults to now)
   */
  constructor(nodeId: string, initialValue: T, timestamp?: number) {
    this.nodeId = nodeId
    this.value = initialValue
    this.timestamp = timestamp ?? Date.now()
    this.version = 1
  }

  /**
   * Sets a new value with the current timestamp.
   * @param value - The new value to set
   * @param timestamp - Optional explicit timestamp (defaults to now)
   */
  set(value: T, timestamp?: number): void {
    const newTimestamp = timestamp ?? Date.now()

    // For local sets, always update (increment timestamp if necessary)
    // This ensures local writes always succeed
    if (newTimestamp <= this.timestamp) {
      this.timestamp = this.timestamp + 1
    } else {
      this.timestamp = newTimestamp
    }

    this.value = value
    this.version++
  }

  /**
   * Gets the current value.
   * @returns The current value stored in the register
   */
  get(): T {
    return this.value
  }

  /**
   * Gets the timestamp of the last update.
   * @returns The timestamp when the value was last set
   */
  getTimestamp(): number {
    return this.timestamp
  }

  /**
   * Gets the current version number.
   * @returns The number of times this register has been updated
   */
  getVersion(): number {
    return this.version
  }

  /**
   * Merges another LWW-Register into this one.
   * The value with the most recent timestamp wins.
   * @param other - The register to merge
   * @returns A new merged LWWRegister
   */
  merge(other: LWWRegister<T>): LWWRegister<T> {
    const merged = this.clone()

    if (other.timestamp > merged.timestamp) {
      merged.value = other.value
      merged.timestamp = other.timestamp
      merged.version = Math.max(merged.version, other.version) + 1
    } else if (other.timestamp === merged.timestamp && other.nodeId > merged.nodeId) {
      // Tie-break: lexicographically greater node ID wins
      merged.value = other.value
      merged.nodeId = other.nodeId
      merged.version = Math.max(merged.version, other.version) + 1
    }

    return merged
  }

  /**
   * Creates a deep copy of this register.
   * @returns A new LWWRegister with the same state
   */
  clone(): LWWRegister<T> {
    const cloned = new LWWRegister<T>(this.nodeId, this.value, this.timestamp)
    cloned.version = this.version
    return cloned
  }

  /**
   * Serializes the register to a plain object.
   * @returns A serializable representation
   */
  toData(): LWWRegisterData<T> {
    return {
      value: this.value,
      timestamp: this.timestamp,
      nodeId: this.nodeId,
      version: this.version,
    }
  }

  /**
   * Deserializes a register from serialized data.
   * @param data - The serialized register data
   * @returns A new LWWRegister instance
   */
  static fromData<T>(data: LWWRegisterData<T>): LWWRegister<T> {
    const register = new LWWRegister<T>(data.nodeId, data.value, data.timestamp)
    register.version = data.version
    return register
  }

  /**
   * Creates a new register with a generated node ID.
   * @param initialValue - The initial value
   * @returns A new LWWRegister with a UUID node ID
   */
  static create<T>(initialValue: T): LWWRegister<T> {
    return new LWWRegister<T>(uuidv4(), initialValue)
  }

  /**
   * Returns a string representation for debugging.
   */
  toString(): string {
    return `LWWRegister(value=${JSON.stringify(this.value)}, ts=${this.timestamp}, node=${this.nodeId.slice(0, 8)})`
  }
}
