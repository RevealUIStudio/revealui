import type { ConflictResolver } from '../../conflict/ConflictResolver';
import { BaseCRDT } from '../base/BaseCRDT';
import type { SerializedCRDT, SerializedLWWRegister } from '../base/CRDTTypes';
import { ConflictResolution } from '../base/CRDTTypes';
import { VectorClock } from '../base/VectorClock';

export class LWWRegister<T> extends BaseCRDT<T> {
  private value: T;
  private timestamp: number;

  constructor(nodeId: string, initialValue: T, conflictResolver?: ConflictResolver) {
    super(nodeId, conflictResolver);
    this.value = initialValue;
    this.timestamp = Date.now();
  }

  set(value: T, timestamp?: number): void {
    const ts = timestamp || Date.now();
    this.incrementClock();

    if (ts > this.timestamp) {
      this.value = value;
      this.timestamp = ts;
    }
  }

  get(): T {
    return this.value;
  }

  getTimestamp(): number {
    return this.timestamp;
  }

  merge(remote: LWWRegister<T>): void {
    // Merge vector clocks first
    this.vectorClock.merge(remote.getVectorClock());

    // Apply conflict resolution
    if (this.conflictResolver) {
      const resolution = this.conflictResolver.resolve(
        this.value,
        remote.value,
        this.timestamp,
        remote.timestamp,
        this.nodeId,
        remote.getNodeId()
      );

      if (resolution.shouldUpdate) {
        this.value = resolution.value;
        this.timestamp = resolution.timestamp;
      }
    } else {
      // Default behavior: last write wins
      if (remote.timestamp > this.timestamp ||
          (remote.timestamp === this.timestamp && remote.getNodeId() > this.nodeId)) {
        this.value = remote.value;
        this.timestamp = remote.timestamp;
      }
    }
  }

  deserialize(data: SerializedCRDT): void {
    const lwwData = data as SerializedLWWRegister<T>;
    this.value = lwwData.value;
    this.timestamp = lwwData.timestamp;
    this.vectorClock = VectorClock.deserialize(data.vectorClock, data.nodeId);
  }

  serialize(): SerializedLWWRegister<T> {
    return {
      type: 'LWWRegister',
      nodeId: this.nodeId,
      data: { value: this.value, timestamp: this.timestamp },
      value: this.value,
      timestamp: this.timestamp,
      vectorClock: this.vectorClock.serialize()
    };
  }

  static deserialize<T>(data: SerializedLWWRegister<T>): LWWRegister<T> {
    const instance = new LWWRegister<T>(data.nodeId, data.value);
    instance.timestamp = data.timestamp;
    instance.vectorClock = VectorClock.deserialize(data.vectorClock, data.nodeId);
    return instance;
  }

  private getLastWriter(): string {
    // Simple implementation - can be enhanced with vector clock comparison
    return this.nodeId;
  }
}
