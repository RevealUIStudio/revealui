import { describe, it, expect } from 'vitest'
import { VectorClock, LWWRegister, ORSet, PNCounter } from '../src/crdt/index'

describe('VectorClock', () => {
  it('should initialize with zero for the node', () => {
    const clock = new VectorClock('node-a')
    expect(clock.get('node-a')).toBe(0)
  })

  it('should increment on tick', () => {
    const clock = new VectorClock('node-a')
    clock.tick()
    expect(clock.get('node-a')).toBe(1)
    clock.tick()
    expect(clock.get('node-a')).toBe(2)
  })

  it('should merge clocks correctly', () => {
    const clock1 = new VectorClock('node-a')
    const clock2 = new VectorClock('node-b')
    
    clock1.tick() // a: 1
    clock2.tick() // b: 1
    clock2.tick() // b: 2
    
    clock1.merge(clock2)
    
    expect(clock1.get('node-a')).toBe(1)
    expect(clock1.get('node-b')).toBe(2)
  })

  it('should compare clocks correctly', () => {
    const clock1 = new VectorClock('node-a')
    const clock2 = new VectorClock('node-b')
    
    // Both at zero - equal
    expect(clock1.compare(clock2)).toBe('equal')
    
    // clock1 advances
    clock1.tick()
    expect(clock1.compare(clock2)).toBe('after')
    expect(clock2.compare(clock1)).toBe('before')
    
    // clock2 advances independently - concurrent
    clock2.tick()
    expect(clock1.compare(clock2)).toBe('concurrent')
  })

  it('should serialize and deserialize', () => {
    const clock1 = new VectorClock('node-a')
    clock1.tick()
    clock1.tick()
    
    const payload = clock1.toPayload()
    const clock2 = VectorClock.fromPayload(payload, 'node-b')
    
    expect(clock2.get('node-a')).toBe(2)
  })
})

describe('LWWRegister', () => {
  it('should store and retrieve values', () => {
    const reg = new LWWRegister<string>('node-a', 'initial')
    expect(reg.get()).toBe('initial')
    
    reg.set('updated')
    expect(reg.get()).toBe('updated')
  })

  it('should merge with later timestamp winning', () => {
    const reg1 = new LWWRegister<string>('node-a', 'value-a', 1000)
    const reg2 = new LWWRegister<string>('node-b', 'value-b', 2000)
    
    const merged = reg1.merge(reg2)
    expect(merged.get()).toBe('value-b')
  })

  it('should tie-break using node ID', () => {
    const reg1 = new LWWRegister<string>('node-a', 'value-a', 1000)
    const reg2 = new LWWRegister<string>('node-b', 'value-b', 1000) // Same timestamp
    
    const merged = reg1.merge(reg2)
    expect(merged.get()).toBe('value-b') // 'node-b' > 'node-a' lexicographically
  })

  it('should serialize and deserialize', () => {
    const reg1 = new LWWRegister<number>('node-a', 42)
    const payload = reg1.toPayload()
    const reg2 = LWWRegister.fromPayload(payload)
    
    expect(reg2.get()).toBe(42)
    expect(reg2.getTimestamp()).toBe(reg1.getTimestamp())
  })

  it('should work with complex objects', () => {
    interface Config {
      theme: string
      fontSize: number
    }
    
    const reg = LWWRegister.create<Config>({ theme: 'dark', fontSize: 14 })
    reg.set({ theme: 'light', fontSize: 16 })
    
    expect(reg.get()).toEqual({ theme: 'light', fontSize: 16 })
  })
})

describe('ORSet', () => {
  it('should add and retrieve elements', () => {
    const set = new ORSet<string>('node-a')
    set.add('item1')
    set.add('item2')
    
    expect(set.values()).toContain('item1')
    expect(set.values()).toContain('item2')
    expect(set.size).toBe(2)
  })

  it('should remove elements by tag', () => {
    const set = new ORSet<string>('node-a')
    const tag1 = set.add('item1')
    set.add('item2')
    
    set.remove(tag1)
    
    expect(set.hasValue('item1')).toBe(false)
    expect(set.hasValue('item2')).toBe(true)
    expect(set.size).toBe(1)
  })

  it('should remove elements by value', () => {
    const set = new ORSet<string>('node-a')
    set.add('item1')
    set.add('item1') // Add same value twice (different tags)
    set.add('item2')
    
    const removed = set.removeByValue('item1')
    
    expect(removed).toBe(2)
    expect(set.hasValue('item1')).toBe(false)
    expect(set.hasValue('item2')).toBe(true)
  })

  it('should merge sets correctly', () => {
    const set1 = new ORSet<string>('node-a')
    const set2 = new ORSet<string>('node-b')
    
    set1.add('item1')
    set2.add('item2')
    
    const merged = set1.merge(set2)
    
    expect(merged.hasValue('item1')).toBe(true)
    expect(merged.hasValue('item2')).toBe(true)
    expect(merged.size).toBe(2)
  })

  it('should handle concurrent add and remove', () => {
    const set1 = new ORSet<string>('node-a')
    // set2 is node B (used in clone below)
    
    // Node A adds item
    const tag = set1.add('item')
    
    // Clone to node B
    const set2Clone = set1.clone()
    
    // Node A removes
    set1.remove(tag)
    
    // Node B adds same item again (different tag)
    set2Clone.add('item')
    
    // Merge: removed tag should stay removed, but new add survives
    const merged = set1.merge(set2Clone)
    expect(merged.hasValue('item')).toBe(true)
  })

  it('should serialize and deserialize', () => {
    const set1 = new ORSet<number>('node-a')
    set1.add(1)
    set1.add(2)
    set1.add(3)
    
    const payload = set1.toPayload()
    const set2 = ORSet.fromPayload<number>(payload)
    
    expect(set2.values()).toEqual(expect.arrayContaining([1, 2, 3]))
    expect(set2.size).toBe(3)
  })
})

describe('PNCounter', () => {
  it('should increment correctly', () => {
    const counter = new PNCounter('node-a')
    counter.increment()
    counter.increment(5)
    
    expect(counter.value()).toBe(6)
  })

  it('should decrement correctly', () => {
    const counter = new PNCounter('node-a')
    counter.increment(10)
    counter.decrement(3)
    
    expect(counter.value()).toBe(7)
  })

  it('should allow negative values', () => {
    const counter = new PNCounter('node-a')
    counter.decrement(5)
    
    expect(counter.value()).toBe(-5)
  })

  it('should merge counters correctly', () => {
    const counter1 = new PNCounter('node-a')
    const counter2 = new PNCounter('node-b')
    
    counter1.increment(10)
    counter2.increment(5)
    counter2.decrement(2)
    
    const merged = counter1.merge(counter2)
    
    expect(merged.value()).toBe(13) // 10 + 5 - 2
  })

  it('should track contributions by node', () => {
    const counter = new PNCounter('node-a')
    counter.increment(5)
    counter.decrement(2)
    
    expect(counter.getIncrement('node-a')).toBe(5)
    expect(counter.getDecrement('node-a')).toBe(2)
  })

  it('should serialize and deserialize', () => {
    const counter1 = new PNCounter('node-a')
    counter1.increment(100)
    counter1.decrement(30)
    
    const payload = counter1.toPayload()
    const counter2 = PNCounter.fromPayload(payload)
    
    expect(counter2.value()).toBe(70)
    expect(counter2.totalIncrements()).toBe(100)
    expect(counter2.totalDecrements()).toBe(30)
  })

  it('should throw on negative delta', () => {
    const counter = new PNCounter('node-a')
    
    expect(() => counter.increment(-1)).toThrow()
    expect(() => counter.decrement(-1)).toThrow()
  })
})
