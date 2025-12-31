import { LWWRegister, ORSet, PNCounter } from '../../src';
import { TimestampResolver } from '../../src/conflict/TimestampResolver';

describe('CRDT Performance Tests', () => {
  test('LWWRegister should handle 10k operations/second', () => {
    const register = new LWWRegister('test', 'initial', new TimestampResolver());
    const startTime = performance.now();

    for (let i = 0; i < 10000; i++) {
      register.set(`value-${i}`, i);
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    const operationsPerSecond = 10000 / (duration / 1000);

    console.log(`LWWRegister: ${operationsPerSecond.toFixed(0)} ops/sec`);
    expect(operationsPerSecond).toBeGreaterThan(10000);
  });

  test('ORSet should handle 10k operations/second', () => {
    const orSet = new ORSet('test', new TimestampResolver());
    const startTime = performance.now();

    for (let i = 0; i < 10000; i++) {
      orSet.add(`element-${i}`);
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    const operationsPerSecond = 10000 / (duration / 1000);

    console.log(`ORSet: ${operationsPerSecond.toFixed(0)} ops/sec`);
    expect(operationsPerSecond).toBeGreaterThan(10000);
  });

  test('PN-Counter should handle 10k operations/second', () => {
    const counter = new PNCounter('test', 0, new TimestampResolver());
    const startTime = performance.now();

    for (let i = 0; i < 10000; i++) {
      counter.increment(1);
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    const operationsPerSecond = 10000 / (duration / 1000);

    console.log(`PN-Counter: ${operationsPerSecond.toFixed(0)} ops/sec`);
    expect(operationsPerSecond).toBeGreaterThan(10000);
  });
});
