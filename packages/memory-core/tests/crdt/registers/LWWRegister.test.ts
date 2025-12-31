import { TimestampResolver } from '../../../src/conflict/TimestampResolver';
import { LWWRegister } from '../../../src/crdt/registers/LWWRegister';

describe('LWWRegister', () => {
  let register1: LWWRegister<string>;
  let register2: LWWRegister<string>;

  beforeEach(() => {
    register1 = new LWWRegister('node1', 'initial', new TimestampResolver());
    register2 = new LWWRegister('node2', 'initial', new TimestampResolver());
  });

  test('should set value with higher timestamp', () => {
    const futureTimestamp = Date.now() + 10000; // 10 seconds in the future
    register1.set('new-value', futureTimestamp);
    expect(register1.get()).toBe('new-value');
    expect(register1.getTimestamp()).toBe(futureTimestamp);
  });

  test('should merge with remote register', () => {
    const now = Date.now();
    register1.set('value1', now + 1000);
    register2.set('value2', now + 2000);

    register1.merge(register2);
    expect(register1.get()).toBe('value2');
  });

  test('should handle concurrent updates', () => {
    const now = Date.now();
    register1.set('value1', now + 1000);
    register2.set('value2', now + 1000);

    register1.merge(register2);
    // Should resolve based on node ID since timestamps are equal
    expect(['value1', 'value2']).toContain(register1.get());
  });

  test('should serialize and deserialize correctly', () => {
    const now = Date.now();
    register1.set('test-value', now + 1234);
    const serialized = register1.serialize();

    const deserialized = LWWRegister.deserialize(serialized);
    expect(deserialized.get()).toBe('test-value');
    expect(deserialized.getTimestamp()).toBe(now + 1234);
  });
});
