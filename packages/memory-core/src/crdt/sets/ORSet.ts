import type { ConflictResolver } from '../../conflict/ConflictResolver';
import { BaseCRDT } from '../base/BaseCRDT';
import type { SerializedCRDT, SerializedORSet } from '../base/CRDTTypes';
import { VectorClock } from '../base/VectorClock';

export class ORSet extends BaseCRDT<Set<string>> {
  private addedElements: Map<string, Set<string>> = new Map();
  private removedElements: Map<string, Set<string>> = new Map();

  constructor(nodeId: string, conflictResolver?: ConflictResolver) {
    super(nodeId, conflictResolver);
  }

  add(element: string): void {
    this.incrementClock();
    const uniqueTag = this.generateUniqueTag(element);

    if (!this.addedElements.has(element)) {
      this.addedElements.set(element, new Set());
    }

    this.addedElements.get(element)!.add(uniqueTag);
  }

  remove(element: string): void {
    this.incrementClock();

    if (!this.addedElements.has(element)) {
      this.removedElements.set(element, new Set());
    }

    const addedTags = this.addedElements.get(element);
    if (addedTags) {
      if (!this.removedElements.has(element)) {
        this.removedElements.set(element, new Set());
      }
      addedTags.forEach(tag => this.removedElements.get(element)!.add(tag));
    }
  }

  getElements(): Set<string> {
    const elements = new Set<string>();

    for (const [element, addedTags] of this.addedElements) {
      const removedTags = this.removedElements.get(element) || new Set();
      const effectiveTags = new Set([...addedTags].filter(tag => !removedTags.has(tag)));

      if (effectiveTags.size > 0) {
        elements.add(element);
      }
    }

    return elements;
  }

  has(element: string): boolean {
    return this.getElements().has(element);
  }

  size(): number {
    return this.getElements().size;
  }

  merge(remote: ORSet): void {
    this.vectorClock.merge(remote.getVectorClock());

    // Merge added elements
    for (const [element, remoteAddedTags] of remote.addedElements) {
      if (!this.addedElements.has(element)) {
        this.addedElements.set(element, new Set());
      }

      const localAddedTags = this.addedElements.get(element) || new Set();
      remoteAddedTags.forEach(tag => localAddedTags.add(tag));
    }

    // Merge removed elements
    for (const [element, remoteRemovedTags] of remote.removedElements) {
      if (!this.removedElements.has(element)) {
        this.removedElements.set(element, new Set());
      }

      const localRemovedTags = this.removedElements.get(element) || new Set();
      remoteRemovedTags.forEach(tag => localRemovedTags.add(tag));
    }
  }

  serialize(): SerializedORSet {
    return {
      type: 'ORSet',
      nodeId: this.nodeId,
      data: {
        addedElements: Object.fromEntries(
          Array.from(this.addedElements.entries()).map(([key, set]) => [
            key,
            Array.from(set)
          ])
        ),
        removedElements: Object.fromEntries(
          Array.from(this.removedElements.entries()).map(([key, set]) => [
            key,
            Array.from(set)
          ])
        )
      },
      addedElements: Object.fromEntries(
        Array.from(this.addedElements.entries()).map(([key, set]) => [
          key,
          Array.from(set)
        ])
      ),
      removedElements: Object.fromEntries(
        Array.from(this.removedElements.entries()).map(([key, set]) => [
          key,
          Array.from(set)
        ])
      ),
      vectorClock: this.vectorClock.serialize()
    };
  }

  deserialize(data: SerializedCRDT): void {
    const orSetData = data as SerializedORSet;
    this.addedElements = new Map(
      Object.entries(orSetData.addedElements).map(([key, value]) => [
        key,
        new Set(value)
      ])
    );
    this.removedElements = new Map(
      Object.entries(orSetData.removedElements).map(([key, value]) => [
        key,
        new Set(value)
      ])
    );
    this.vectorClock = VectorClock.deserialize(data.vectorClock, data.nodeId);
  }

  static deserialize(data: SerializedORSet): ORSet {
    const instance = new ORSet(data.nodeId);

    instance.addedElements = new Map(
      Object.entries(data.addedElements).map(([key, value]) => [
        key,
        new Set(value)
      ])
    );

    instance.removedElements = new Map(
      Object.entries(data.removedElements).map(([key, value]) => [
        key,
        new Set(value)
      ])
    );

    instance.vectorClock = VectorClock.deserialize(data.vectorClock, data.nodeId);
    return instance;
  }

  private generateUniqueTag(element: string): string {
    return `${this.nodeId}-${element}-${Date.now()}-${Math.random().toString(36)}`;
  }
}
