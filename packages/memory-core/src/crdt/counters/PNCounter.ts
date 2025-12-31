import type { ConflictResolver } from '../../conflict/ConflictResolver';
import { BaseCRDT } from '../base/BaseCRDT';
import type { SerializedCRDT, SerializedPNCounter } from '../base/CRDTTypes';
import { VectorClock } from '../base/VectorClock';

export class PNCounter extends BaseCRDT<number> {
  private positiveCount: number = 0;
  private negativeCount: number = 0;

  constructor(nodeId: string, initialValue: number = 0, conflictResolver?: ConflictResolver) {
    super(nodeId, conflictResolver);

    if (initialValue > 0) {
      this.positiveCount = initialValue;
    } else {
      this.negativeCount = Math.abs(initialValue);
    }
  }

  increment(delta: number = 1): void {
    this.incrementClock();
    if (delta > 0) {
      this.positiveCount += delta;
    } else {
      this.negativeCount += Math.abs(delta);
    }
  }

  decrement(delta: number = 1): void {
    this.incrementClock();
    this.increment(-delta);
  }

  getValue(): number {
    return this.positiveCount - this.negativeCount;
  }

  getPositiveCount(): number {
    return this.positiveCount;
  }

  getNegativeCount(): number {
    return this.negativeCount;
  }

  merge(remote: PNCounter): void {
    this.vectorClock.merge(remote.getVectorClock());
    this.positiveCount += remote.getPositiveCount();
    this.negativeCount += remote.getNegativeCount();
  }

  serialize(): SerializedPNCounter {
    return {
      type: 'PNCounter',
      nodeId: this.nodeId,
      data: {
        positiveCount: this.positiveCount,
        negativeCount: this.negativeCount
      },
      positiveCount: this.positiveCount,
      negativeCount: this.negativeCount,
      vectorClock: this.vectorClock.serialize()
    };
  }

  deserialize(data: SerializedCRDT): void {
    const pnCounterData = data as SerializedPNCounter;
    this.positiveCount = pnCounterData.positiveCount;
    this.negativeCount = pnCounterData.negativeCount;
    this.vectorClock = VectorClock.deserialize(data.vectorClock, data.nodeId);
  }

  static deserialize(data: SerializedPNCounter): PNCounter {
    const instance = new PNCounter(data.nodeId, 0);
    instance.positiveCount = data.positiveCount;
    instance.negativeCount = data.negativeCount;
    instance.vectorClock = VectorClock.deserialize(data.vectorClock, data.nodeId);
    return instance;
  }
}
