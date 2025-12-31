import type { ConflictResolver } from '../../conflict/ConflictResolver';

import type { SerializedCRDT } from './CRDTTypes';
import { VectorClock } from './VectorClock';

export abstract class BaseCRDT<T> {
  protected nodeId: string;
  protected vectorClock: VectorClock;
  protected conflictResolver: ConflictResolver | undefined;

  constructor(nodeId: string, conflictResolver?: ConflictResolver) {
    this.nodeId = nodeId;
    this.vectorClock = new VectorClock(nodeId);
    this.conflictResolver = conflictResolver;
  }

  abstract merge(remote: BaseCRDT<T>): void;
  abstract serialize(): SerializedCRDT;
  abstract deserialize(data: SerializedCRDT): void;

  protected incrementClock(): number {
    return this.vectorClock.increment();
  }

  protected getNodeId(): string {
    return this.nodeId;
  }

  protected getVectorClock(): VectorClock {
    return this.vectorClock;
  }
}
