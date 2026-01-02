/**
 * CRDT (Conflict-free Replicated Data Types) implementations
 * 
 * These data structures enable eventual consistency in distributed systems
 * without requiring coordination between nodes.
 * 
 * @packageDocumentation
 */

export { VectorClock, type VectorClockPayload, type VectorClockComparison } from './vector-clock'
export { LWWRegister, type LWWRegisterPayload } from './lww-register'
export { ORSet, type ORSetPayload, type ORSetEntry } from './or-set'
export { PNCounter, type PNCounterPayload } from './pn-counter'
