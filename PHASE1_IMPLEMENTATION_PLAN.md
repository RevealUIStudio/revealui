# RevealUI CRDT Memory System - Phase 1 Implementation Plan

## Overview
This document provides a detailed, step-by-step implementation plan for Phase 1 of the RevealUI CRDT Memory System. Phase 1 focuses on building the core CRDT infrastructure that will serve as the foundation for the entire memory system.

## Project Structure

### 1.1 Package Organization
Create a new package `@revealui/memory-core` following the existing monorepo structure:

```
packages/
└── @revealui/memory-core/
    ├── src/
    │   ├── crdt/
    │   │   ├── base.ts              # Base CRDT interface
    │   │   ├── lww-register.ts      # LWW-Register implementation
    │   │   ├── or-set.ts           # OR-Set implementation
    │   │   ├── pn-counter.ts       # PN-Counter implementation
    │   │   ├── vector-clock.ts     # Vector Clock implementation
    │   │   ├── conflict-resolver.ts # Conflict resolution strategies
    │   │   └── index.ts            # CRDT exports
    │   ├── memory/
    │   │   ├── memory-node.ts      # Memory node abstraction
    │   │   ├── memory-store.ts     # In-memory store
    │   │   ├── types.ts            # Memory type definitions
    │   │   └── index.ts            # Memory exports
    │   ├── utils/
    │   │   ├── id-generator.ts     # Unique ID generation
    │   │   ├── serializer.ts       # Serialization utilities
    │   │   ├── validator.ts        # Input validation
    │   │   └── index.ts            # Utility exports
    │   ├── errors/
    │   │   ├── crdt-errors.ts      # CRDT-specific errors
    │   │   └── index.ts            # Error exports
    │   └── index.ts                # Main package exports
    ├── tests/
    │   ├── crdt/
    │   │   ├── lww-register.test.ts
    │   │   ├── or-set.test.ts
    │   │   ├── pn-counter.test.ts
    │   │   ├── vector-clock.test.ts
    │   │   └── conflict-resolver.test.ts
    │   ├── memory/
    │   │   ├── memory-node.test.ts
    │   │   └── memory-store.test.ts
    │   ├── integration/
    │   │   └── crdt-integration.test.ts
    │   └── performance/
    │       └── crdt-benchmarks.test.ts
    ├── package.json
    ├── tsconfig.json
    ├── tsup.config.ts
    └── README.md
```

### 1.2 Package Configuration

#### package.json
```json
{
  "name": "@revealui/memory-core",
  "version": "0.1.0",
  "description": "CRDT-based memory core for RevealUI",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./crdt": {
      "types": "./dist/crdt/index.d.ts",
      "import": "./dist/crdt/index.js"
    },
    "./memory": {
      "types": "./dist/memory/index.d.ts",
      "import": "./dist/memory/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest --coverage",
    "lint": "eslint src/**/*.ts",
    "typecheck": "tsc --noEmit",
    "benchmark": "vitest run --config vitest.benchmark.config.ts"
  },
  "dependencies": {
    "uuid": "^10.0.0",
    "nanoid": "^5.0.0"
  },
  "devDependencies": {
    "@types/uuid": "^10.0.0",
    "@vitest/coverage-v8": "^2.0.0",
    "eslint": "^9.39.2",
    "tsup": "^8.5.1",
    "typescript": "^5.9.3",
    "vitest": "^2.0.0"
  }
}
```

#### tsconfig.json
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

## Step-by-Step Implementation

### Step 1: Core Types and Interfaces

#### File: `src/utils/types.ts`
```typescript
/**
 * Core types for CRDT implementation
 */

export type NodeId = string;
export type Timestamp = number;
export type CRDTId = string;

export interface CRDTMetadata {
  id: CRDTId;
  nodeId: NodeId;
  timestamp: Timestamp;
  version: number;
}

export interface CRDTState {
  metadata: CRDTMetadata;
  payload: unknown;
}

export interface VectorClockEntry {
  nodeId: NodeId;
  timestamp: Timestamp;
}

export type VectorClock = Map<NodeId, Timestamp>;

export interface Serializable {
  toJSON(): string;
  fromJSON(json: string): void;
}

export interface Mergeable<T> {
  merge(other: T): void;
}

export interface Comparable {
  compare(other: unknown): number;
}
```

### Step 2: Vector Clock Implementation

#### File: `src/crdt/vector-clock.ts`
```typescript
import { NodeId, Timestamp, VectorClock, VectorClockEntry } from '../utils/types';

/**
 * Vector Clock implementation for causal ordering
 */
export class VectorClock implements Serializable, Mergeable<VectorClock> {
  private clock: VectorClock;
  private nodeId: NodeId;

  constructor(nodeId: NodeId, initialClock?: VectorClock) {
    this.nodeId = nodeId;
    this.clock = new Map(initialClock);
    this.increment();
  }

  /**
   * Increment the clock for the current node
   */
  increment(): void {
    const current = this.clock.get(this.nodeId) || 0;
    this.clock.set(this.nodeId, current + 1);
  }

  /**
   * Get the timestamp for a specific node
   */
  getTimestamp(nodeId: NodeId): Timestamp {
    return this.clock.get(nodeId) || 0;
  }

  /**
   * Get the current timestamp for this node
   */
  getCurrentTimestamp(): Timestamp {
    return this.getTimestamp(this.nodeId);
  }

  /**
   * Check if this clock happened before another
   */
  happensBefore(other: VectorClock): boolean {
    let hasSmaller = false;
    
    for (const [nodeId, timestamp] of this.clock.entries()) {
      const otherTimestamp = other.get(nodeId) || 0;
      if (timestamp > otherTimestamp) {
        return false;
      }
      if (timestamp < otherTimestamp) {
        hasSmaller = true;
      }
    }
    
    // Check if other has entries we don't have
    for (const [nodeId, timestamp] of other.entries()) {
      if (!this.clock.has(nodeId) && timestamp > 0) {
        hasSmaller = true;
      }
    }
    
    return hasSmaller;
  }

  /**
   * Check if two clocks are concurrent
   */
  isConcurrentWith(other: VectorClock): boolean {
    const thisBeforeOther = this.happensBefore(other);
    const otherBeforeThis = new VectorClock(this.nodeId, other).happensBefore(this.clock);
    
    return !thisBeforeOther && !otherBeforeThis;
  }

  /**
   * Merge this clock with another (element-wise maximum)
   */
  merge(other: VectorClock): void {
    for (const [nodeId, timestamp] of other.entries()) {
      const currentTimestamp = this.clock.get(nodeId) || 0;
      this.clock.set(nodeId, Math.max(currentTimestamp, timestamp));
    }
  }

  /**
   * Create a copy of this vector clock
   */
  copy(): VectorClock {
    return new Map(this.clock);
  }

  /**
   * Get all entries as an array
   */
  entries(): VectorClockEntry[] {
    return Array.from(this.clock.entries()).map(([nodeId, timestamp]) => ({
      nodeId,
      timestamp
    }));
  }

  /**
   * Serialize to JSON
   */
  toJSON(): string {
    return JSON.stringify({
      nodeId: this.nodeId,
      clock: Object.fromEntries(this.clock)
    });
  }

  /**
   * Deserialize from JSON
   */
  fromJSON(json: string): void {
    const data = JSON.parse(json);
    this.nodeId = data.nodeId;
    this.clock = new Map(Object.entries(data.clock));
  }

  /**
   * Create from JSON string
   */
  static fromJSON(json: string): VectorClock {
    const vc = new VectorClock('');
    vc.fromJSON(json);
    return vc;
  }

  /**
   * Get string representation
   */
  toString(): string {
    const entries = Array.from(this.clock.entries())
      .map(([nodeId, timestamp]) => `${nodeId}:${timestamp}`)
      .join(', ');
    return `{${entries}}`;
  }
}
```

### Step 3: Base CRDT Interface

#### File: `src/crdt/base.ts`
```typescript
import { CRDTId, CRDTMetadata, NodeId, Timestamp } from '../utils/types';
import { VectorClock } from './vector-clock';

/**
 * Base interface for all CRDT implementations
 */
export interface ICRDT<T = unknown> {
  readonly id: CRDTId;
  readonly nodeId: NodeId;
  readonly metadata: CRDTMetadata;
  
  value(): T;
  merge(other: ICRDT<T>): void;
  toJSON(): string;
  fromJSON(json: string): void;
  clone(): ICRDT<T>;
}

/**
 * Abstract base class for CRDT implementations
 */
export abstract class BaseCRDT<T> implements ICRDT<T> {
  protected _id: CRDTId;
  protected _nodeId: NodeId;
  protected _vectorClock: VectorClock;
  protected _metadata: CRDTMetadata;

  constructor(id: CRDTId, nodeId: NodeId) {
    this._id = id;
    this._nodeId = nodeId;
    this._vectorClock = new VectorClock(nodeId);
    this._metadata = {
      id,
      nodeId,
      timestamp: this._vectorClock.getCurrentTimestamp(),
      version: 1
    };
  }

  get id(): CRDTId {
    return this._id;
  }

  get nodeId(): NodeId {
    return this._nodeId;
  }

  get metadata(): CRDTMetadata {
    return { ...this._metadata };
  }

  /**
   * Get the current value of the CRDT
   */
  abstract value(): T;

  /**
   * Merge with another CRDT of the same type
   */
  abstract merge(other: ICRDT<T>): void;

  /**
   * Serialize to JSON
   */
  abstract toJSON(): string;

  /**
   * Deserialize from JSON
   */
  abstract fromJSON(json: string): void;

  /**
   * Create a deep copy of this CRDT
   */
  abstract clone(): ICRDT<T>;

  /**
   * Update the vector clock and metadata
   */
  protected updateMetadata(): void {
    this._vectorClock.increment();
    this._metadata.timestamp = this._vectorClock.getCurrentTimestamp();
    this._metadata.version += 1;
  }

  /**
   * Validate that another CRDT is compatible for merging
   */
  protected validateMerge(other: ICRDT<T>): void {
    if (this._id !== other.id) {
      throw new Error(`Cannot merge CRDTs with different IDs: ${this._id} vs ${other.id}`);
    }
    
    if (this.constructor !== other.constructor) {
      throw new Error(`Cannot merge CRDTs of different types`);
    }
  }
}
```

### Step 4: LWW-Register Implementation

#### File: `src/crdt/lww-register.ts`
```typescript
import { BaseCRDT, ICRDT } from './base';
import { CRDTId, NodeId } from '../utils/types';

/**
 * Interface for LWW-Register payload
 */
export interface LWWRegisterPayload<T> {
  value: T;
  timestamp: number;
  nodeId: NodeId;
}

/**
 * Last-Writer-Wins Register CRDT implementation
 * 
 * LWW-Register stores a single value and uses timestamps to resolve conflicts.
 * The write with the highest timestamp wins. In case of ties, node IDs are used.
 */
export class LWWRegister<T> extends BaseCRDT<T> {
  private _value: T;
  private _timestamp: number;

  constructor(id: CRDTId, nodeId: NodeId, initialValue?: T) {
    super(id, nodeId);
    this._value = initialValue as T;
    this._timestamp = this._vectorClock.getCurrentTimestamp();
  }

  /**
   * Get the current value
   */
  value(): T {
    return this._value;
  }

  /**
   * Set a new value
   */
  set(value: T, timestamp?: number): void {
    this._value = value;
    this._timestamp = timestamp ?? Date.now();
    this.updateMetadata();
  }

  /**
   * Get the timestamp of the current value
   */
  getTimestamp(): number {
    return this._timestamp;
  }

  /**
   * Merge with another LWW-Register
   */
  merge(other: ICRDT<T>): void {
    this.validateMerge(other);
    
    const otherLWW = other as LWWRegister<T>;
    
    // Use vector clock to determine causality
    if (this._vectorClock.happensBefore(otherLWW._vectorClock.clock)) {
      // Other operation happened after this one
      this._value = otherLWW._value;
      this._timestamp = otherLWW._timestamp;
      this._vectorClock.merge(otherLWW._vectorClock.clock);
    } else if (otherLWW._vectorClock.happensBefore(this._vectorClock.clock)) {
      // This operation happened after the other one
      // Keep current value
    } else {
      // Concurrent operations - use timestamp as tiebreaker
      if (otherLWW._timestamp > this._timestamp) {
        this._value = otherLWW._value;
        this._timestamp = otherLWW._timestamp;
      } else if (otherLWW._timestamp === this._timestamp) {
        // Same timestamp - use node ID as deterministic tiebreaker
        if (otherLWW.nodeId > this.nodeId) {
          this._value = otherLWW._value;
          this._timestamp = otherLWW._timestamp;
        }
      }
      // Merge vector clocks
      this._vectorClock.merge(otherLWW._vectorClock.clock);
    }
    
    this.updateMetadata();
  }

  /**
   * Serialize to JSON
   */
  toJSON(): string {
    const payload: LWWRegisterPayload<T> = {
      value: this._value,
      timestamp: this._timestamp,
      nodeId: this.nodeId
    };
    
    return JSON.stringify({
      type: 'LWWRegister',
      id: this._id,
      metadata: this._metadata,
      vectorClock: this._vectorClock.toJSON(),
      payload
    });
  }

  /**
   * Deserialize from JSON
   */
  fromJSON(json: string): void {
    const data = JSON.parse(json);
    
    if (data.type !== 'LWWRegister') {
      throw new Error(`Invalid CRDT type: expected LWWRegister, got ${data.type}`);
    }
    
    this._id = data.id;
    this._metadata = data.metadata;
    this._vectorClock = VectorClock.fromJSON(data.vectorClock);
    this._value = data.payload.value;
    this._timestamp = data.payload.timestamp;
  }

  /**
   * Create a deep copy
   */
  clone(): LWWRegister<T> {
    const cloned = new LWWRegister<T>(this._id, this.nodeId, this._value);
    cloned._timestamp = this._timestamp;
    cloned._metadata = { ...this._metadata };
    cloned._vectorClock = new VectorClock(this.nodeId, this._vectorClock.copy());
    return cloned;
  }

  /**
   * Create from JSON string
   */
  static fromJSON<T>(json: string): LWWRegister<T> {
    const lww = new LWWRegister<T>('', '');
    lww.fromJSON(json);
    return lww;
  }

  /**
   * Create from payload
   */
  static fromPayload<T>(
    id: CRDTId, 
    nodeId: NodeId, 
    payload: LWWRegisterPayload<T>
  ): LWWRegister<T> {
    const lww = new LWWRegister<T>(id, nodeId, payload.value);
    lww._timestamp = payload.timestamp;
    return lww;
  }
}
```

### Step 5: OR-Set Implementation

#### File: `src/crdt/or-set.ts`
```typescript
import { BaseCRDT, ICRDT } from './base';
import { CRDTId, NodeId } from '../utils/types';
import { nanoid } from 'nanoid';

/**
 * Interface for OR-Set payload
 */
export interface ORSetPayload<T> {
  added: Record<string, T>;
  removed: string[];
}

/**
 * Observed-Removed Set CRDT implementation
 * 
 * OR-Set maintains a set of unique elements with add and remove operations.
 * Uses unique tags for each element to handle concurrent add/remove operations.
 */
export class ORSet<T> extends BaseCRDT<Set<T>> {
  private added: Map<string, T>;
  private removed: Set<string>;

  constructor(id: CRDTId, nodeId: NodeId, initialElements?: T[]) {
    super(id, nodeId);
    this.added = new Map();
    this.removed = new Set();
    
    if (initialElements) {
      for (const element of initialElements) {
        this.add(element);
      }
    }
  }

  /**
   * Get the current value as a Set
   */
  value(): Set<T> {
    const result = new Set<T>();
    
    for (const [tag, element] of this.added.entries()) {
      if (!this.removed.has(tag)) {
        result.add(element);
      }
    }
    
    return result;
  }

  /**
   * Get all current values as an array
   */
  values(): T[] {
    return Array.from(this.value());
  }

  /**
   * Check if an element exists in the set
   */
  has(element: T): boolean {
    // Find the tag for this element
    for (const [tag, value] of this.added.entries()) {
      if (this.deepEqual(value, element) && !this.removed.has(tag)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Add an element to the set
   */
  add(element: T): string {
    const tag = nanoid();
    this.added.set(tag, element);
    this.updateMetadata();
    return tag;
  }

  /**
   * Remove an element from the set
   */
  remove(element: T): boolean {
    let removed = false;
    
    // Find and mark all matching elements as removed
    for (const [tag, value] of this.added.entries()) {
      if (this.deepEqual(value, element)) {
        this.removed.add(tag);
        removed = true;
      }
    }
    
    if (removed) {
      this.updateMetadata();
    }
    
    return removed;
  }

  /**
   * Get the number of elements in the set
   */
  size(): number {
    return this.value().size;
  }

  /**
   * Check if the set is empty
   */
  isEmpty(): boolean {
    return this.size() === 0;
  }

  /**
   * Clear all elements from the set
   */
  clear(): void {
    // Mark all added elements as removed
    for (const tag of this.added.keys()) {
      this.removed.add(tag);
    }
    this.updateMetadata();
  }

  /**
   * Merge with another OR-Set
   */
  merge(other: ICRDT<Set<T>>): void {
    this.validateMerge(other);
    
    const otherORSet = other as ORSet<T>;
    
    // Merge added elements
    for (const [tag, element] of otherORSet.added.entries()) {
      if (!this.added.has(tag)) {
        this.added.set(tag, element);
      }
    }
    
    // Merge removed elements
    for (const tag of otherORSet.removed) {
      this.removed.add(tag);
    }
    
    // Merge vector clocks
    this._vectorClock.merge(otherORSet._vectorClock.clock);
    this.updateMetadata();
  }

  /**
   * Serialize to JSON
   */
  toJSON(): string {
    const payload: ORSetPayload<T> = {
      added: Object.fromEntries(this.added),
      removed: Array.from(this.removed)
    };
    
    return JSON.stringify({
      type: 'ORSet',
      id: this._id,
      metadata: this._metadata,
      vectorClock: this._vectorClock.toJSON(),
      payload
    });
  }

  /**
   * Deserialize from JSON
   */
  fromJSON(json: string): void {
    const data = JSON.parse(json);
    
    if (data.type !== 'ORSet') {
      throw new Error(`Invalid CRDT type: expected ORSet, got ${data.type}`);
    }
    
    this._id = data.id;
    this._metadata = data.metadata;
    this._vectorClock = VectorClock.fromJSON(data.vectorClock);
    
    this.added = new Map(Object.entries(data.payload.added));
    this.removed = new Set(data.payload.removed);
  }

  /**
   * Create a deep copy
   */
  clone(): ORSet<T> {
    const cloned = new ORSet<T>(this._id, this.nodeId);
    cloned.added = new Map(this.added);
    cloned.removed = new Set(this.removed);
    cloned._metadata = { ...this._metadata };
    cloned._vectorClock = new VectorClock(this.nodeId, this._vectorClock.copy());
    return cloned;
  }

  /**
   * Create from JSON string
   */
  static fromJSON<T>(json: string): ORSet<T> {
    const orSet = new ORSet<T>('', '');
    orSet.fromJSON(json);
    return orSet;
  }

  /**
   * Create from payload
   */
  static fromPayload<T>(
    id: CRDTId,
    nodeId: NodeId,
    payload: ORSetPayload<T>
  ): ORSet<T> {
    const orSet = new ORSet<T>(id, nodeId);
    orSet.added = new Map(Object.entries(payload.added));
    orSet.removed = new Set(payload.removed);
    return orSet;
  }

  /**
   * Deep equality check for elements
   */
  private deepEqual(a: T, b: T): boolean {
    if (a === b) return true;
    
    if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
      return JSON.stringify(a) === JSON.stringify(b);
    }
    
    return false;
  }
}
```

### Step 6: PN-Counter Implementation

#### File: `src/crdt/pn-counter.ts`
```typescript
import { BaseCRDT, ICRDT } from './base';
import { CRDTId, NodeId } from '../utils/types';

/**
 * Interface for PN-Counter payload
 */
export interface PNCounterPayload {
  increments: Record<NodeId, number>;
  decrements: Record<NodeId, number>;
}

/**
 * Positive-Negative Counter CRDT implementation
 * 
 * PN-Counter maintains a counter that can be incremented and decremented.
 * Tracks increments and decrements separately for each node to handle conflicts.
 */
export class PNCounter extends BaseCRDT<number> {
  private increments: Map<NodeId, number>;
  private decrements: Map<NodeId, number>;

  constructor(id: CRDTId, nodeId: NodeId) {
    super(id, nodeId);
    this.increments = new Map();
    this.decrements = new Map();
  }

  /**
   * Get the current value
   */
  value(): number {
    const totalIncrements = Array.from(this.increments.values())
      .reduce((sum, val) => sum + val, 0);
    const totalDecrements = Array.from(this.decrements.values())
      .reduce((sum, val) => sum + val, 0);
    
    return totalIncrements - totalDecrements;
  }

  /**
   * Increment the counter
   */
  increment(nodeId?: NodeId, delta: number = 1): void {
    const targetNodeId = nodeId ?? this.nodeId;
    const current = this.increments.get(targetNodeId) || 0;
    this.increments.set(targetNodeId, current + delta);
    this.updateMetadata();
  }

  /**
   * Decrement the counter
   */
  decrement(nodeId?: NodeId, delta: number = 1): void {
    const targetNodeId = nodeId ?? this.nodeId;
    const current = this.decrements.get(targetNodeId) || 0;
    this.decrements.set(targetNodeId, current + delta);
    this.updateMetadata();
  }

  /**
   * Get increments for a specific node
   */
  getIncrements(nodeId: NodeId): number {
    return this.increments.get(nodeId) || 0;
  }

  /**
   * Get decrements for a specific node
   */
  getDecrements(nodeId: NodeId): number {
    return this.decrements.get(nodeId) || 0;
  }

  /**
   * Get all increments
   */
  getAllIncrements(): Map<NodeId, number> {
    return new Map(this.increments);
  }

  /**
   * Get all decrements
   */
  getAllDecrements(): Map<NodeId, number> {
    return new Map(this.decrements);
  }

  /**
   * Reset the counter to zero
   */
  reset(): void {
    this.increments.clear();
    this.decrements.clear();
    this.updateMetadata();
  }

  /**
   * Merge with another PN-Counter
   */
  merge(other: ICRDT<number>): void {
    this.validateMerge(other);
    
    const otherPN = other as PNCounter;
    
    // Merge increments (element-wise maximum)
    for (const [nodeId, value] of otherPN.increments.entries()) {
      const current = this.increments.get(nodeId) || 0;
      this.increments.set(nodeId, Math.max(current, value));
    }
    
    // Merge decrements (element-wise maximum)
    for (const [nodeId, value] of otherPN.decrements.entries()) {
      const current = this.decrements.get(nodeId) || 0;
      this.decrements.set(nodeId, Math.max(current, value));
    }
    
    // Merge vector clocks
    this._vectorClock.merge(otherPN._vectorClock.clock);
    this.updateMetadata();
  }

  /**
   * Serialize to JSON
   */
  toJSON(): string {
    const payload: PNCounterPayload = {
      increments: Object.fromEntries(this.increments),
      decrements: Object.fromEntries(this.decrements)
    };
    
    return JSON.stringify({
      type: 'PNCounter',
      id: this._id,
      metadata: this._metadata,
      vectorClock: this._vectorClock.toJSON(),
      payload
    });
  }

  /**
   * Deserialize from JSON
   */
  fromJSON(json: string): void {
    const data = JSON.parse(json);
    
    if (data.type !== 'PNCounter') {
      throw new Error(`Invalid CRDT type: expected PNCounter, got ${data.type}`);
    }
    
    this._id = data.id;
    this._metadata = data.metadata;
    this._vectorClock = VectorClock.fromJSON(data.vectorClock);
    
    this.increments = new Map(Object.entries(data.payload.increments));
    this.decrements = new Map(Object.entries(data.payload.decrements));
  }

  /**
   * Create a deep copy
   */
  clone(): PNCounter {
    const cloned = new PNCounter(this._id, this.nodeId);
    cloned.increments = new Map(this.increments);
    cloned.decrements = new Map(this.decrements);
    cloned._metadata = { ...this._metadata };
    cloned._vectorClock = new VectorClock(this.nodeId, this._vectorClock.copy());
    return cloned;
  }

  /**
   * Create from JSON string
   */
  static fromJSON(json: string): PNCounter {
    const counter = new PNCounter('', '');
    counter.fromJSON(json);
    return counter;
  }

  /**
   * Create from payload
   */
  static fromPayload(
    id: CRDTId,
    nodeId: NodeId,
    payload: PNCounterPayload
  ): PNCounter {
    const counter = new PNCounter(id, nodeId);
    counter.increments = new Map(Object.entries(payload.increments));
    counter.decrements = new Map(Object.entries(payload.decrements));
    return counter;
  }
}
```

### Step 7: Conflict Resolution Strategies

#### File: `src/crdt/conflict-resolver.ts`
```typescript
import { ICRDT } from './base';
import { VectorClock } from './vector-clock';
import { NodeId } from '../utils/types';

/**
 * Types of conflict resolution strategies
 */
export enum ConflictResolutionStrategy {
  LWW = 'last-writer-wins',
  NODE_PRIORITY = 'node-priority',
  CUSTOM = 'custom',
  MERGE = 'merge'
}

/**
 * Configuration for node-based priority resolution
 */
export interface NodePriorityConfig {
  priorities: Map<NodeId, number>;
  tieBreaker: 'lowest' | 'highest' | 'random';
}

/**
 * Custom conflict resolver function
 */
export type CustomResolver<T> = (
  local: ICRDT<T>,
  remote: ICRDT<T>,
  context: ConflictContext
) => ICRDT<T>;

/**
 * Context for conflict resolution
 */
export interface ConflictContext {
  vectorClock: VectorClock;
  nodeId: NodeId;
  timestamp: number;
  operation: string;
}

/**
 * Conflict resolver for CRDT operations
 */
export class ConflictResolver<T> {
  private strategy: ConflictResolutionStrategy;
  private nodePriorityConfig?: NodePriorityConfig;
  private customResolver?: CustomResolver<T>;

  constructor(strategy: ConflictResolutionStrategy = ConflictResolutionStrategy.LWW) {
    this.strategy = strategy;
  }

  /**
   * Set node priority configuration
   */
  setNodePriorityConfig(config: NodePriorityConfig): void {
    this.nodePriorityConfig = config;
    this.strategy = ConflictResolutionStrategy.NODE_PRIORITY;
  }

  /**
   * Set custom resolver function
   */
  setCustomResolver(resolver: CustomResolver<T>): void {
    this.customResolver = resolver;
    this.strategy = ConflictResolutionStrategy.CUSTOM;
  }

  /**
   * Resolve conflict between two CRDTs
   */
  resolve(local: ICRDT<T>, remote: ICRDT<T>, context: ConflictContext): ICRDT<T> {
    switch (this.strategy) {
      case ConflictResolutionStrategy.LWW:
        return this.resolveLWW(local, remote, context);
      
      case ConflictResolutionStrategy.NODE_PRIORITY:
        return this.resolveNodePriority(local, remote, context);
      
      case ConflictResolutionStrategy.CUSTOM:
        if (!this.customResolver) {
          throw new Error('Custom resolver not set');
        }
        return this.customResolver(local, remote, context);
      
      case ConflictResolutionStrategy.MERGE:
        return this.resolveMerge(local, remote, context);
      
      default:
        throw new Error(`Unknown conflict resolution strategy: ${this.strategy}`);
    }
  }

  /**
   * Last-Writer-Wins resolution
   */
  private resolveLWW(local: ICRDT<T>, remote: ICRDT<T>, context: ConflictContext): ICRDT<T> {
    const localTime = local.metadata.timestamp;
    const remoteTime = remote.metadata.timestamp;
    
    if (remoteTime > localTime) {
      return remote.clone();
    } else if (localTime > remoteTime) {
      return local.clone();
    } else {
      // Same timestamp - use node ID as tiebreaker
      return remote.nodeId > local.nodeId ? remote.clone() : local.clone();
    }
  }

  /**
   * Node priority based resolution
   */
  private resolveNodePriority(local: ICRDT<T>, remote: ICRDT<T>, context: ConflictContext): ICRDT<T> {
    if (!this.nodePriorityConfig) {
      throw new Error('Node priority configuration not set');
    }
    
    const localPriority = this.nodePriorityConfig.priorities.get(local.nodeId) ?? 0;
    const remotePriority = this.nodePriorityConfig.priorities.get(remote.nodeId) ?? 0;
    
    if (remotePriority > localPriority) {
      return remote.clone();
    } else if (localPriority > remotePriority) {
      return local.clone();
    } else {
      // Same priority - use configured tie-breaker
      return this.resolveTie(local, remote, this.nodePriorityConfig.tieBreaker);
    }
  }

  /**
   * Merge both CRDTs
   */
  private resolveMerge(local: ICRDT<T>, remote: ICRDT<T>, context: ConflictContext): ICRDT<T> {
    const merged = local.clone();
    merged.merge(remote);
    return merged;
  }

  /**
   * Resolve ties based on configuration
   */
  private resolveTie(local: ICRDT<T>, remote: ICRDT<T>, tieBreaker: 'lowest' | 'highest' | 'random'): ICRDT<T> {
    switch (tieBreaker) {
      case 'lowest':
        return local.nodeId < remote.nodeId ? local.clone() : remote.clone();
      
      case 'highest':
        return local.nodeId > remote.nodeId ? local.clone() : remote.clone();
      
      case 'random':
        return Math.random() < 0.5 ? local.clone() : remote.clone();
      
      default:
        return local.clone();
    }
  }

  /**
   * Get current strategy
   */
  getStrategy(): ConflictResolutionStrategy {
    return this.strategy;
  }

  /**
   * Check if two CRDTs are in conflict
   */
  static isInConflict<T>(local: ICRDT<T>, remote: ICRDT<T>): boolean {
    // Check if timestamps are the same but values differ
    if (local.metadata.timestamp === remote.metadata.timestamp) {
      return local.value() !== remote.value();
    }
    
    // Check if operations are concurrent using vector clocks
    // This would need to be implemented based on the specific CRDT type
    return false;
  }
}
```

### Step 8: Memory Store Implementation

#### File: `src/memory/memory-store.ts`
```typescript
import { ICRDT } from '../crdt/base';
import { CRDTId, NodeId } from '../utils/types';
import { ConflictResolver, ConflictResolutionStrategy } from '../crdt/conflict-resolver';

/**
 * Memory store for managing CRDT instances
 */
export class MemoryStore {
  private crdts: Map<CRDTId, ICRDT>;
  private nodeId: NodeId;
  private conflictResolver: ConflictResolver<unknown>;

  constructor(nodeId: NodeId) {
    this.crdts = new Map();
    this.nodeId = nodeId;
    this.conflictResolver = new ConflictResolver(ConflictResolutionStrategy.LWW);
  }

  /**
   * Store a CRDT
   */
  store<T>(crdt: ICRDT<T>): void {
    this.crdts.set(crdt.id, crdt);
  }

  /**
   * Retrieve a CRDT by ID
   */
  get<T>(id: CRDTId): ICRDT<T> | undefined {
    return this.crdts.get(id) as ICRDT<T> | undefined;
  }

  /**
   * Remove a CRDT by ID
   */
  remove(id: CRDTId): boolean {
    return this.crdts.delete(id);
  }

  /**
   * Get all CRDT IDs
   */
  getIds(): CRDTId[] {
    return Array.from(this.crdts.keys());
  }

  /**
   * Get all CRDTs
   */
  getAll(): ICRDT[] {
    return Array.from(this.crdts.values());
  }

  /**
   * Check if a CRDT exists
   */
  has(id: CRDTId): boolean {
    return this.crdts.has(id);
  }

  /**
   * Get the number of stored CRDTs
   */
  size(): number {
    return this.crdts.size;
  }

  /**
   * Clear all CRDTs
   */
  clear(): void {
    this.crdts.clear();
  }

  /**
   * Merge a remote CRDT into the store
   */
  merge<T>(remoteCRDT: ICRDT<T>): ICRDT<T> {
    const localCRDT = this.get<T>(remoteCRDT.id);
    
    if (localCRDT) {
      // Resolve conflicts and merge
      const context = {
        vectorClock: localCRDT.metadata.timestamp > remoteCRDT.metadata.timestamp 
          ? localCRDT.metadata.timestamp 
          : remoteCRDT.metadata.timestamp,
        nodeId: this.nodeId,
        timestamp: Date.now(),
        operation: 'merge'
      };
      
      const resolved = this.conflictResolver.resolve(localCRDT, remoteCRDT, context);
      localCRDT.merge(remoteCRDT);
      return localCRDT;
    } else {
      // Store new CRDT
      this.store(remoteCRDT);
      return remoteCRDT;
    }
  }

  /**
   * Sync with another memory store
   */
  sync(otherStore: MemoryStore): void {
    for (const crdt of otherStore.getAll()) {
      this.merge(crdt);
    }
  }

  /**
   * Serialize the entire store to JSON
   */
  toJSON(): string {
    const serialized = Array.from(this.crdts.entries()).map(([id, crdt]) => ({
      id,
      crdt: crdt.toJSON()
    }));
    
    return JSON.stringify({
      nodeId: this.nodeId,
      crdts: serialized,
      timestamp: Date.now()
    });
  }

  /**
   * Deserialize from JSON
   */
  fromJSON(json: string): void {
    const data = JSON.parse(json);
    this.nodeId = data.nodeId;
    this.crdts.clear();
    
    for (const { id, crdt: crdtJson } of data.crdts) {
      // This would need to be extended to handle different CRDT types
      // based on the type information in the JSON
      const crdtData = JSON.parse(crdtJson);
      let crdt: ICRDT;
      
      switch (crdtData.type) {
        case 'LWWRegister':
          crdt = JSON.parse(crdtJson) as ICRDT;
          break;
        case 'ORSet':
          crdt = JSON.parse(crdtJson) as ICRDT;
          break;
        case 'PNCounter':
          crdt = JSON.parse(crdtJson) as ICRDT;
          break;
        default:
          throw new Error(`Unknown CRDT type: ${crdtData.type}`);
      }
      
      this.crdts.set(id, crdt);
    }
  }

  /**
   * Create a snapshot of the current state
   */
  createSnapshot(): string {
    return this.toJSON();
  }

  /**
   * Restore from a snapshot
   */
  restoreFromSnapshot(snapshot: string): void {
    this.fromJSON(snapshot);
  }

  /**
   * Get statistics about the store
   */
  getStats(): {
    totalCRDTs: number;
    types: Record<string, number>;
    totalSize: number;
  } {
    const types: Record<string, number> = {};
    let totalSize = 0;
    
    for (const crdt of this.crdts.values()) {
      const type = crdt.constructor.name;
      types[type] = (types[type] || 0) + 1;
      totalSize += crdt.toJSON().length;
    }
    
    return {
      totalCRDTs: this.crdts.size,
      types,
      totalSize
    };
  }
}
```

### Step 9: Testing Setup

#### File: `vitest.config.ts`
```typescript
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        'dist/',
        '**/*.test.ts',
        '**/*.spec.ts'
      ]
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@crdt': resolve(__dirname, './src/crdt'),
      '@memory': resolve(__dirname, './src/memory'),
      '@utils': resolve(__dirname, './src/utils')
    }
  }
});
```

#### File: `tests/crdt/lww-register.test.ts`
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { LWWRegister } from '../../src/crdt/lww-register';

describe('LWWRegister', () => {
  let register1: LWWRegister<string>;
  let register2: LWWRegister<string>;

  beforeEach(() => {
    register1 = new LWWRegister('test-id', 'node-1', 'initial');
    register2 = new LWWRegister('test-id', 'node-2', 'initial');
  });

  describe('Basic Operations', () => {
    it('should initialize with initial value', () => {
      expect(register1.value()).toBe('initial');
    });

    it('should set new value', () => {
      register1.set('new-value');
      expect(register1.value()).toBe('new-value');
    });

    it('should maintain timestamp', () => {
      const timestamp = Date.now();
      register1.set('timestamped', timestamp);
      expect(register1.getTimestamp()).toBe(timestamp);
    });
  });

  describe('Merge Operations', () => {
    it('should merge with newer timestamp', () => {
      register1.set('value1');
      register2.set('value2', Date.now() + 1000);
      
      register1.merge(register2);
      expect(register1.value()).toBe('value2');
    });

    it('should keep value with older timestamp', () => {
      register1.set('value1', Date.now() + 1000);
      register2.set('value2');
      
      register1.merge(register2);
      expect(register1.value()).toBe('value1');
    });

    it('should use node ID as tiebreaker', () => {
      const timestamp = Date.now();
      register1.set('value1', timestamp);
      register2.set('value2', timestamp);
      
      register1.merge(register2);
      expect(register1.value()).toBe('value2'); // node-2 > node-1
    });
  });

  describe('Serialization', () => {
    it('should serialize to JSON', () => {
      register1.set('test-value');
      const json = register1.toJSON();
      
      expect(json).toContain('LWWRegister');
      expect(json).toContain('test-id');
      expect(json).toContain('test-value');
    });

    it('should deserialize from JSON', () => {
      register1.set('test-value');
      const json = register1.toJSON();
      
      const deserialized = LWWRegister.fromJSON<string>(json);
      expect(deserialized.value()).toBe('test-value');
      expect(deserialized.id).toBe('test-id');
    });

    it('should create exact copy after serialization roundtrip', () => {
      register1.set('roundtrip-test');
      const json = register1.toJSON();
      const deserialized = LWWRegister.fromJSON<string>(json);
      
      expect(deserialized.value()).toBe(register1.value());
      expect(deserialized.id).toBe(register1.id);
      expect(deserialized.nodeId).toBe(register1.nodeId);
    });
  });

  describe('Clone Operations', () => {
    it('should create independent clone', () => {
      register1.set('original');
      const clone = register1.clone();
      
      clone.set('modified');
      expect(register1.value()).toBe('original');
      expect(clone.value()).toBe('modified');
    });
  });

  describe('Error Handling', () => {
    it('should throw error when merging different IDs', () => {
      const differentId = new LWWRegister('different-id', 'node-1');
      
      expect(() => {
        register1.merge(differentId);
      }).toThrow('Cannot merge CRDTs with different IDs');
    });

    it('should throw error when merging different types', () => {
      expect(() => {
        register1.merge({} as any);
      }).toThrow('Cannot merge CRDTs of different types');
    });
  });
});
```

#### File: `tests/crdt/or-set.test.ts`
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { ORSet } from '../../src/crdt/or-set';

describe('ORSet', () => {
  let set1: ORSet<string>;
  let set2: ORSet<string>;

  beforeEach(() => {
    set1 = new ORSet('test-id', 'node-1');
    set2 = new ORSet('test-id', 'node-2');
  });

  describe('Basic Operations', () => {
    it('should initialize empty', () => {
      expect(set1.size()).toBe(0);
      expect(set1.isEmpty()).toBe(true);
    });

    it('should add elements', () => {
      set1.add('item1');
      set1.add('item2');
      
      expect(set1.size()).toBe(2);
      expect(set1.has('item1')).toBe(true);
      expect(set1.has('item2')).toBe(true);
    });

    it('should remove elements', () => {
      set1.add('item1');
      set1.add('item2');
      
      expect(set1.remove('item1')).toBe(true);
      expect(set1.has('item1')).toBe(false);
      expect(set1.has('item2')).toBe(true);
      expect(set1.size()).toBe(1);
    });

    it('should return values as array', () => {
      set1.add('item1');
      set1.add('item2');
      
      const values = set1.values();
      expect(values).toContain('item1');
      expect(values).toContain('item2');
      expect(values).toHaveLength(2);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent adds', () => {
      set1.add('item1');
      set2.add('item2');
      
      set1.merge(set2);
      
      expect(set1.has('item1')).toBe(true);
      expect(set1.has('item2')).toBe(true);
      expect(set1.size()).toBe(2);
    });

    it('should handle concurrent add/remove', () => {
      set1.add('item1');
      set2.add('item1');
      set2.remove('item1');
      
      set1.merge(set2);
      
      // Item should still exist because it was added in set1
      expect(set1.has('item1')).toBe(true);
    });

    it('should handle remove-then-add scenario', () => {
      set1.add('item1');
      set1.remove('item1');
      set2.add('item1');
      
      set1.merge(set2);
      
      expect(set1.has('item1')).toBe(true);
    });
  });

  describe('Serialization', () => {
    it('should serialize to JSON', () => {
      set1.add('item1');
      set1.add('item2');
      
      const json = set1.toJSON();
      expect(json).toContain('ORSet');
      expect(json).toContain('item1');
      expect(json).toContain('item2');
    });

    it('should deserialize from JSON', () => {
      set1.add('item1');
      set1.add('item2');
      
      const json = set1.toJSON();
      const deserialized = ORSet.fromJSON<string>(json);
      
      expect(deserialized.has('item1')).toBe(true);
      expect(deserialized.has('item2')).toBe(true);
      expect(deserialized.size()).toBe(2);
    });
  });

  describe('Complex Objects', () => {
    it('should handle object elements', () => {
      const obj1 = { id: 1, name: 'test' };
      const obj2 = { id: 2, name: 'test2' };
      
      set1.add(obj1);
      set1.add(obj2);
      
      expect(set1.has(obj1)).toBe(true);
      expect(set1.has(obj2)).toBe(true);
    });
  });
});
```

#### File: `tests/crdt/pn-counter.test.ts`
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { PNCounter } from '../../src/crdt/pn-counter';

describe('PNCounter', () => {
  let counter1: PNCounter;
  let counter2: PNCounter;

  beforeEach(() => {
    counter1 = new PNCounter('test-id', 'node-1');
    counter2 = new PNCounter('test-id', 'node-2');
  });

  describe('Basic Operations', () => {
    it('should initialize at zero', () => {
      expect(counter1.value()).toBe(0);
    });

    it('should increment', () => {
      counter1.increment();
      expect(counter1.value()).toBe(1);
    });

    it('should decrement', () => {
      counter1.increment();
      counter1.decrement();
      expect(counter1.value()).toBe(0);
    });

    it('should handle multiple increments', () => {
      counter1.increment();
      counter1.increment();
      counter1.increment();
      expect(counter1.value()).toBe(3);
    });

    it('should handle custom delta', () => {
      counter1.increment('node-1', 5);
      expect(counter1.value()).toBe(5);
    });
  });

  describe('Node-specific Operations', () => {
    it('should track increments per node', () => {
      counter1.increment('node-1', 3);
      counter1.increment('node-2', 2);
      
      expect(counter1.getIncrements('node-1')).toBe(3);
      expect(counter1.getIncrements('node-2')).toBe(2);
      expect(counter1.value()).toBe(5);
    });

    it('should track decrements per node', () => {
      counter1.increment('node-1', 5);
      counter1.decrement('node-1', 2);
      counter1.decrement('node-2', 1);
      
      expect(counter1.getDecrements('node-1')).toBe(2);
      expect(counter1.getDecrements('node-2')).toBe(1);
      expect(counter1.value()).toBe(2);
    });
  });

  describe('Merge Operations', () => {
    it('should merge increments correctly', () => {
      counter1.increment('node-1', 3);
      counter2.increment('node-2', 2);
      
      counter1.merge(counter2);
      
      expect(counter1.value()).toBe(5);
      expect(counter1.getIncrements('node-1')).toBe(3);
      expect(counter1.getIncrements('node-2')).toBe(2);
    });

    it('should merge decrements correctly', () => {
      counter1.increment('node-1', 5);
      counter1.decrement('node-1', 1);
      counter2.decrement('node-2', 2);
      
      counter1.merge(counter2);
      
      expect(counter1.value()).toBe(2);
      expect(counter1.getDecrements('node-1')).toBe(1);
      expect(counter1.getDecrements('node-2')).toBe(2);
    });

    it('should use maximum for concurrent operations', () => {
      counter1.increment('node-1', 3);
      counter2.increment('node-1', 5); // Higher value for same node
      
      counter1.merge(counter2);
      
      expect(counter1.getIncrements('node-1')).toBe(5);
      expect(counter1.value()).toBe(5);
    });
  });

  describe('Serialization', () => {
    it('should serialize to JSON', () => {
      counter1.increment('node-1', 3);
      counter1.decrement('node-2', 1);
      
      const json = counter1.toJSON();
      expect(json).toContain('PNCounter');
      expect(json).toContain('node-1');
      expect(json).toContain('node-2');
    });

    it('should deserialize from JSON', () => {
      counter1.increment('node-1', 3);
      counter1.decrement('node-2', 1);
      
      const json = counter1.toJSON();
      const deserialized = PNCounter.fromJSON(json);
      
      expect(deserialized.value()).toBe(2);
      expect(deserialized.getIncrements('node-1')).toBe(3);
      expect(deserialized.getDecrements('node-2')).toBe(1);
    });
  });

  describe('Reset Operations', () => {
    it('should reset to zero', () => {
      counter1.increment('node-1', 5);
      counter1.decrement('node-2', 2);
      
      counter1.reset();
      
      expect(counter1.value()).toBe(0);
      expect(counter1.getAllIncrements().size).toBe(0);
      expect(counter1.getAllDecrements().size).toBe(0);
    });
  });
});
```

### Step 10: Integration with Existing Codebase

#### File: `src/index.ts`
```typescript
// CRDT exports
export { BaseCRDT, ICRDT } from './crdt/base';
export { LWWRegister } from './crdt/lww-register';
export { ORSet } from './crdt/or-set';
export { PNCounter } from './crdt/pn-counter';
export { VectorClock } from './crdt/vector-clock';
export { ConflictResolver, ConflictResolutionStrategy } from './crdt/conflict-resolver';

// Memory exports
export { MemoryStore } from './memory/memory-store';

// Utility exports
export * from './utils/types';
export * from './utils/id-generator';
export * from './utils/serializer';
export * from './utils/validator';

// Error exports
export * from './errors/crdt-errors';
```

#### Update Root Package.json
```json
{
  "workspaces": [
    "packages/*",
    "packages/@revealui/memory-core"
  ]
}
```

## Implementation Order

### Week 1: Core Infrastructure
1. **Day 1-2**: Set up package structure and basic types
2. **Day 3-4**: Implement Vector Clock
3. **Day 5**: Implement Base CRDT interface

### Week 2: CRDT Implementations
1. **Day 1-2**: Implement LWW-Register with tests
2. **Day 3-4**: Implement OR-Set with tests
3. **Day 5**: Implement PN-Counter with tests

### Week 3: Advanced Features
1. **Day 1-2**: Implement Conflict Resolution
2. **Day 3-4**: Implement Memory Store
3. **Day 5**: Integration tests and documentation

## Performance Considerations

### 1. Memory Optimization
- Use object pooling for frequently created CRDT instances
- Implement lazy loading for large OR-Sets
- Add memory compaction for removed elements

### 2. Computational Optimization
- Cache vector clock comparisons
- Use efficient data structures (Maps over Objects)
- Implement batch operations for bulk updates

### 3. Serialization Optimization
- Use binary serialization for large payloads
- Implement delta compression for sync operations
- Add compression for network transfer

## Error Handling Strategy

### 1. Validation Errors
- Input validation for all public methods
- Type checking for generic parameters
- Range validation for numeric operations

### 2. Concurrency Errors
- Detection of conflicting operations
- Automatic conflict resolution
- Manual conflict resolution hooks

### 3. System Errors
- Graceful degradation for memory issues
- Retry mechanisms for transient failures
- Fallback strategies for critical errors

## Testing Strategy

### 1. Unit Tests
- 100% coverage for all CRDT operations
- Property-based testing for edge cases
- Performance regression tests

### 2. Integration Tests
- Multi-node synchronization scenarios
- Conflict resolution validation
- Serialization roundtrip tests

### 3. Performance Tests
- Benchmark for 100k operations/second
- Memory usage profiling
- Latency measurements for merge operations

This implementation plan provides a comprehensive foundation for the RevealUI CRDT Memory System, with detailed code patterns, testing strategies, and integration guidelines for developers to follow.