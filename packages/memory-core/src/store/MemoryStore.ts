import type { ConflictResolver } from '../conflict/ConflictResolver';
import type { BaseCRDT } from '../crdt/base/BaseCRDT';
import type { SerializedCRDT, SerializedLWWRegister, SerializedORSet, SerializedPNCounter } from '../crdt/base/CRDTTypes';
import { PNCounter } from '../crdt/counters/PNCounter';
import { LWWRegister } from '../crdt/registers/LWWRegister';
import { ORSet } from '../crdt/sets/ORSet';

export class MemoryStore {
  private crdtInstances: Map<string, BaseCRDT<unknown>> = new Map();
  private nodeId: string;
  private conflictResolver: ConflictResolver | undefined;

  constructor(nodeId: string, conflictResolver?: ConflictResolver) {
    this.nodeId = nodeId;
    this.conflictResolver = conflictResolver;
  }

  createLWWRegister<T>(id: string, initialValue: T): LWWRegister<T> {
    const register = new LWWRegister(this.nodeId, initialValue, this.conflictResolver);
    this.crdtInstances.set(id, register);
    return register;
  }

  createORSet(id: string): ORSet {
    const orSet = new ORSet(this.nodeId, this.conflictResolver);
    this.crdtInstances.set(id, orSet);
    return orSet;
  }

  createPNCounter(id: string, initialValue: number = 0): PNCounter {
    const counter = new PNCounter(this.nodeId, initialValue, this.conflictResolver);
    this.crdtInstances.set(id, counter);
    return counter;
  }

  getCRDT<T extends BaseCRDT<unknown>>(id: string): T | undefined {
    return this.crdtInstances.get(id) as T | undefined;
  }

  mergeRemoteCRDT(id: string, serializedCRDT: SerializedCRDT): void {
    const localCRDT = this.crdtInstances.get(id);
    if (!localCRDT) {
      throw new Error(`CRDT with id ${id} not found`);
    }

    const remoteCRDT = this.deserializeCRDT(serializedCRDT);
    localCRDT.merge(remoteCRDT);
  }

  private deserializeCRDT(serialized: SerializedCRDT): BaseCRDT<unknown> {
    switch (serialized.type) {
      case 'LWWRegister':
        return LWWRegister.deserialize(serialized as SerializedLWWRegister<unknown>);
      case 'ORSet':
        return ORSet.deserialize(serialized as SerializedORSet);
      case 'PNCounter':
        return PNCounter.deserialize(serialized as SerializedPNCounter);
      default:
        throw new Error(`Unknown CRDT type: ${(serialized as SerializedCRDT).type}`);
    }
  }
}
