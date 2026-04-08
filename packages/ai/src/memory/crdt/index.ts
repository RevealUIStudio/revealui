/**
 * CRDT (Conflict-free Replicated Data Types) implementations
 *
 * These data structures enable eventual consistency in distributed systems
 * without requiring coordination between nodes.
 *
 * @packageDocumentation
 */

export { LWWRegister, type LWWRegisterData } from './lww-register.js';
export { ORSet, type ORSetData, type ORSetEntry } from './or-set.js';
export { PNCounter, type PNCounterData } from './pn-counter.js';
export {
  VectorClock,
  type VectorClockComparison,
  type VectorClockData,
} from './vector-clock.js';
