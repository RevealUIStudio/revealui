import { TimestampResolver } from '../../../src/conflict/TimestampResolver';
import { PNCounter } from '../../../src/crdt/counters/PNCounter';

describe('PNCounter', () => {
  let counter1: PNCounter;
  let counter2: PNCounter;

  beforeEach(() => {
    counter1 = new PNCounter('node1', 0, new TimestampResolver());
    counter2 = new PNCounter('node2', 0, new TimestampResolver());
  });

  test('should increment and decrement correctly', () => {
    counter1.increment(5);
    expect(counter1.getValue()).toBe(5);

    counter1.decrement(2);
    expect(counter1.getValue()).toBe(3);
  });

  test('should merge with remote counter', () => {
    counter1.increment(5);
    counter2.increment(3);

    counter1.merge(counter2);
    expect(counter1.getValue()).toBe(8);
  });

  test('should handle negative values', () => {
    counter1.decrement(5);
    expect(counter1.getValue()).toBe(-5);
    expect(counter1.getNegativeCount()).toBe(5);
  });

  test('should serialize and deserialize correctly', () => {
    counter1.increment(10);
    const serialized = counter1.serialize();

    const deserialized = PNCounter.deserialize(serialized);
    expect(deserialized.getValue()).toBe(10);
    expect(deserialized.getPositiveCount()).toBe(10);
  });
});
