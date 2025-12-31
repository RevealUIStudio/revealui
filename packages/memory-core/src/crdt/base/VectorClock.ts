import type { VectorClock as IVectorClock } from './CRDTTypes';

export class VectorClock implements IVectorClock {
  public entries: Map<string, number> = new Map();
  private nodeId: string;

  constructor(nodeId: string) {
    this.nodeId = nodeId;
    this.entries.set(nodeId, 0);
  }

  increment(nodeId?: string): number {
    const id = nodeId || this.nodeId;
    const current = this.entries.get(id) || 0;
    const newValue = current + 1;
    this.entries.set(id, newValue);
    return newValue;
  }

  get(nodeId: string): number {
    return this.entries.get(nodeId) || 0;
  }

  merge(other: VectorClock): void {
    for (const [nodeId, time] of other.entries) {
      const currentTime = this.entries.get(nodeId) || 0;
      this.entries.set(nodeId, Math.max(currentTime, time));
    }
  }

  compare(other: VectorClock): -1 | 0 | 1 {
    let thisGreater = false;
    let otherGreater = false;

    for (const [nodeId, time] of this.entries) {
      const otherTime = other.get(nodeId);
      if (time > otherTime) thisGreater = true;
      if (time < otherTime) otherGreater = true;
    }

    for (const [nodeId, time] of other.entries) {
      const thisTime = this.get(nodeId);
      if (thisTime > time) thisGreater = true;
      if (thisTime < time) otherGreater = true;
    }

    if (thisGreater && !otherGreater) return 1;
    if (otherGreater && !thisGreater) return -1;
    return 0;
  }

  serialize(): Record<string, number> {
    return Object.fromEntries(this.entries);
  }

  static deserialize(data: Record<string, number>, nodeId: string): VectorClock {
    const clock = new VectorClock(nodeId);
    clock.entries = new Map(Object.entries(data));
    return clock;
  }
}
