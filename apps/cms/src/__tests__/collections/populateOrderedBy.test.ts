import { beforeEach, describe, expect, it, vi } from 'vitest';
import { populateOrderedBy } from '@/lib/collections/Orders/hooks/populateOrderedBy';

type HookArgs = Parameters<typeof populateOrderedBy>[0];

describe('populateOrderedBy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const callHook = (overrides: Partial<HookArgs> & Pick<HookArgs, 'req' | 'operation'>) =>
    populateOrderedBy({
      value: undefined as unknown as HookArgs['value'],
      data: {} as unknown as HookArgs['data'],
      originalDoc: undefined as unknown as HookArgs['originalDoc'],
      field: {} as unknown as HookArgs['field'],
      siblingData: {} as unknown as HookArgs['siblingData'],
      context: {} as unknown as HookArgs['context'],
      ...overrides,
    });

  it('returns the current user ID on create when value is empty', async () => {
    const result = await callHook({
      req: { user: { id: 'user-123' } } as unknown as HookArgs['req'],
      operation: 'create',
    });

    expect(result).toBe('user-123');
  });

  it('returns the current user ID on update when value is empty', async () => {
    const result = await callHook({
      req: { user: { id: 'user-456' } } as unknown as HookArgs['req'],
      operation: 'update',
    });

    expect(result).toBe('user-456');
  });

  it('preserves existing value when already set', async () => {
    const result = await callHook({
      req: { user: { id: 'user-789' } } as unknown as HookArgs['req'],
      operation: 'create',
      value: 'existing-user-id' as unknown as HookArgs['value'],
    });

    expect(result).toBe('existing-user-id');
  });

  it('returns null when no user is present and value is empty', async () => {
    const result = await callHook({
      req: {} as unknown as HookArgs['req'],
      operation: 'create',
    });

    expect(result).toBeNull();
  });

  it('returns value as-is for non-create/update operations', async () => {
    const result = await callHook({
      req: { user: { id: 'user-1' } } as unknown as HookArgs['req'],
      operation: 'read' as unknown as HookArgs['operation'],
      value: 'some-value' as unknown as HookArgs['value'],
    });

    expect(result).toBe('some-value');
  });

  it('returns null when user has no id', async () => {
    const result = await callHook({
      req: { user: { email: 'test@example.com' } } as unknown as HookArgs['req'],
      operation: 'create',
      value: null as unknown as HookArgs['value'],
    });

    // value is null (falsy), so it enters the branch; user.id is undefined -> returns undefined ?? null
    expect(result).toBeNull();
  });
});
