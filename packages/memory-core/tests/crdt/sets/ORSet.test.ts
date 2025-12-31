import { TimestampResolver } from '../../../src/conflict/TimestampResolver';
import { ORSet } from '../../../src/crdt/sets/ORSet';

describe('ORSet', () => {
  let orSet1: ORSet;
  let orSet2: ORSet;

  beforeEach(() => {
    orSet1 = new ORSet('node1', new TimestampResolver());
    orSet2 = new ORSet('node2', new TimestampResolver());
  });

  test('should add and remove elements correctly', () => {
    orSet1.add('element1');
    expect(orSet1.has('element1')).toBe(true);
    expect(orSet1.size()).toBe(1);

    orSet1.remove('element1');
    expect(orSet1.has('element1')).toBe(false);
    expect(orSet1.size()).toBe(0);
  });

  test('should merge with remote ORSet', () => {
    orSet1.add('element1');
    orSet2.add('element2');

    orSet1.merge(orSet2);
    expect(orSet1.has('element1')).toBe(true);
    expect(orSet1.has('element2')).toBe(true);
    expect(orSet1.size()).toBe(2);
  });

  test('should handle concurrent add/remove operations', () => {
    orSet1.add('element1');
    orSet2.add('element1'); // Both replicas have the element
    orSet2.remove('element1'); // Then it's removed from replica 2

    orSet1.merge(orSet2);
    // Element should still exist because orSet1's add operation is still valid
    expect(orSet1.has('element1')).toBe(true);
  });

  test('should serialize and deserialize correctly', () => {
    orSet1.add('test-element');
    const serialized = orSet1.serialize();

    const deserialized = ORSet.deserialize(serialized);
    expect(deserialized.has('test-element')).toBe(true);
    expect(deserialized.size()).toBe(1);
  });
});
