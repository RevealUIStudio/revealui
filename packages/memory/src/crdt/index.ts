/**
 * CRDT (Conflict-free Replicated Data Types) implementations
 * 
 * These data structures enable eventual consistency in distributed systems
 * without requiring coordination between nodes.
 * 
 * @packageDocumentation
 */

export { VectorClock, type VectorClockData, type VectorClockComparison } from './vector-clock'
export { LWWRegister, type LWWRegisterData } from './lww-register'
export { ORSet, type ORSetData, type ORSetEntry } from './or-set'
export { PNCounter, type PNCounterData } from './pn-counter'
