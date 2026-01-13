# Performance Guide

## Cloning Strategy

The memory system uses deep cloning to ensure immutability and prevent data corruption. Understanding the cloning strategy is important for performance optimization.

### Cloning Layers

1. **LWWRegister Level** (Core CRDT)
   - `get()`: Clones object/array values on every call
   - `set()`: Clones values when storing
   - `merge()`: Clones winning values during merge
   - `toData()`: Clones values when serializing

2. **WorkingMemory Level**
   - `getContext()`: Returns cloned context from LWWRegister
   - `getContextValue()`: Returns value from cloned context (no additional cloning)
   - `setContext()`: Clones entire context object
   - `updateContext()`: Clones context once for multiple updates

3. **AgentContextManager Level**
   - `getContext()`: Returns value from cloned context (no additional cloning)
   - `getAllContext()`: Returns cloned context from WorkingMemory
   - `setContext()`: Validates then sets (cloning happens in WorkingMemory)
   - `updateContext()`: Validates then updates (cloning happens in WorkingMemory)

### Performance Implications

#### ✅ Efficient Operations

- **Single key access**: `getContext(key)` - No double cloning
- **Multiple updates**: `updateContext({ k1: v1, k2: v2 })` - Single clone
- **Primitive values**: No cloning overhead

#### ⚠️ Performance Considerations

- **Large contexts**: Every `getContext()` clones the entire context
- **Frequent updates**: Each update clones the context
- **Deep nesting**: Deep cloning is recursive and can be slow for very deep objects

### Best Practices

1. **Batch Updates**: Use `updateContext()` for multiple changes instead of multiple `setContext()` calls
   ```typescript
   // ❌ Bad: Clones context 3 times
   manager.setContext('key1', 'value1')
   manager.setContext('key2', 'value2')
   manager.setContext('key3', 'value3')
   
   // ✅ Good: Clones context once
   manager.updateContext({
     key1: 'value1',
     key2: 'value2',
     key3: 'value3',
   })
   ```

2. **Cache Context**: If you need to access multiple values, get the full context once
   ```typescript
   // ❌ Bad: Clones context multiple times
   const value1 = manager.getContext('key1')
   const value2 = manager.getContext('key2')
   const value3 = manager.getContext('key3')
   
   // ✅ Good: Clone once, access multiple times
   const context = manager.getAllContext()
   const value1 = context.key1
   const value2 = context.key2
   const value3 = context.key3
   ```

3. **Avoid Deep Nesting**: Keep context structure relatively flat
   ```typescript
   // ❌ Bad: Very deep nesting
   context: {
     user: {
       profile: {
         settings: {
           theme: {
             color: 'dark'
           }
         }
       }
     }
   }
   
   // ✅ Good: Flatter structure
   context: {
     'user.profile.settings.theme.color': 'dark'
   }
   ```

4. **Use Primitives When Possible**: Primitives don't require cloning
   ```typescript
   // ✅ Good: Primitives are fast
   manager.setContext('count', 42)
   manager.setContext('name', 'John')
   
   // ⚠️ Consider: Objects require cloning
   manager.setContext('user', { name: 'John', age: 30 })
   ```

### Size Limits

The system enforces limits to prevent performance issues:

- **Max Context Keys**: 10,000 keys
- **Max Context Size**: ~10MB (approximate)
- **Max Object Depth**: 100 levels

These limits prevent:
- Memory exhaustion
- Stack overflow from deep recursion
- Performance degradation from huge objects

### Monitoring Performance

If you experience performance issues:

1. **Profile Context Size**: Check how large your contexts are
2. **Monitor Clone Operations**: Count how many times contexts are cloned
3. **Check Depth**: Ensure objects aren't too deeply nested
4. **Review Update Patterns**: Look for opportunities to batch updates

### Future Optimizations

Potential optimizations (not yet implemented):

- **Lazy Cloning**: Only clone when values are actually accessed
- **Structural Sharing**: Share unchanged parts of objects
- **Caching**: Cache cloned values for frequently accessed keys
- **Incremental Updates**: Only clone changed parts of context
