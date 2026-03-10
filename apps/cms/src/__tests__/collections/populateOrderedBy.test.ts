import { beforeEach, describe, expect, it, vi } from 'vitest'
import { populateOrderedBy } from '@/lib/collections/Orders/hooks/populateOrderedBy'

describe('populateOrderedBy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the current user ID on create when value is empty', async () => {
    const result = await populateOrderedBy({
      req: { user: { id: 'user-123' } } as unknown as Parameters<
        typeof populateOrderedBy
      >[0]['req'],
      operation: 'create',
      value: undefined,
      data: {} as unknown as Parameters<typeof populateOrderedBy>[0]['data'],
      originalDoc: undefined as unknown as Parameters<typeof populateOrderedBy>[0]['originalDoc'],
      field: {} as unknown as Parameters<typeof populateOrderedBy>[0]['field'],
      siblingData: {} as unknown as Parameters<typeof populateOrderedBy>[0]['siblingData'],
      path: [] as unknown as Parameters<typeof populateOrderedBy>[0]['path'],
      schemaPath: [] as unknown as Parameters<typeof populateOrderedBy>[0]['schemaPath'],
      collection: undefined as unknown as Parameters<typeof populateOrderedBy>[0]['collection'],
      context: {} as unknown as Parameters<typeof populateOrderedBy>[0]['context'],
    })

    expect(result).toBe('user-123')
  })

  it('returns the current user ID on update when value is empty', async () => {
    const result = await populateOrderedBy({
      req: { user: { id: 'user-456' } } as unknown as Parameters<
        typeof populateOrderedBy
      >[0]['req'],
      operation: 'update',
      value: undefined,
      data: {} as unknown as Parameters<typeof populateOrderedBy>[0]['data'],
      originalDoc: undefined as unknown as Parameters<typeof populateOrderedBy>[0]['originalDoc'],
      field: {} as unknown as Parameters<typeof populateOrderedBy>[0]['field'],
      siblingData: {} as unknown as Parameters<typeof populateOrderedBy>[0]['siblingData'],
      path: [] as unknown as Parameters<typeof populateOrderedBy>[0]['path'],
      schemaPath: [] as unknown as Parameters<typeof populateOrderedBy>[0]['schemaPath'],
      collection: undefined as unknown as Parameters<typeof populateOrderedBy>[0]['collection'],
      context: {} as unknown as Parameters<typeof populateOrderedBy>[0]['context'],
    })

    expect(result).toBe('user-456')
  })

  it('preserves existing value when already set', async () => {
    const result = await populateOrderedBy({
      req: { user: { id: 'user-789' } } as unknown as Parameters<
        typeof populateOrderedBy
      >[0]['req'],
      operation: 'create',
      value: 'existing-user-id',
      data: {} as unknown as Parameters<typeof populateOrderedBy>[0]['data'],
      originalDoc: undefined as unknown as Parameters<typeof populateOrderedBy>[0]['originalDoc'],
      field: {} as unknown as Parameters<typeof populateOrderedBy>[0]['field'],
      siblingData: {} as unknown as Parameters<typeof populateOrderedBy>[0]['siblingData'],
      path: [] as unknown as Parameters<typeof populateOrderedBy>[0]['path'],
      schemaPath: [] as unknown as Parameters<typeof populateOrderedBy>[0]['schemaPath'],
      collection: undefined as unknown as Parameters<typeof populateOrderedBy>[0]['collection'],
      context: {} as unknown as Parameters<typeof populateOrderedBy>[0]['context'],
    })

    expect(result).toBe('existing-user-id')
  })

  it('returns null when no user is present and value is empty', async () => {
    const result = await populateOrderedBy({
      req: {} as unknown as Parameters<typeof populateOrderedBy>[0]['req'],
      operation: 'create',
      value: undefined,
      data: {} as unknown as Parameters<typeof populateOrderedBy>[0]['data'],
      originalDoc: undefined as unknown as Parameters<typeof populateOrderedBy>[0]['originalDoc'],
      field: {} as unknown as Parameters<typeof populateOrderedBy>[0]['field'],
      siblingData: {} as unknown as Parameters<typeof populateOrderedBy>[0]['siblingData'],
      path: [] as unknown as Parameters<typeof populateOrderedBy>[0]['path'],
      schemaPath: [] as unknown as Parameters<typeof populateOrderedBy>[0]['schemaPath'],
      collection: undefined as unknown as Parameters<typeof populateOrderedBy>[0]['collection'],
      context: {} as unknown as Parameters<typeof populateOrderedBy>[0]['context'],
    })

    expect(result).toBeNull()
  })

  it('returns value as-is for non-create/update operations', async () => {
    const result = await populateOrderedBy({
      req: { user: { id: 'user-1' } } as unknown as Parameters<typeof populateOrderedBy>[0]['req'],
      operation: 'read' as unknown as Parameters<typeof populateOrderedBy>[0]['operation'],
      value: 'some-value',
      data: {} as unknown as Parameters<typeof populateOrderedBy>[0]['data'],
      originalDoc: undefined as unknown as Parameters<typeof populateOrderedBy>[0]['originalDoc'],
      field: {} as unknown as Parameters<typeof populateOrderedBy>[0]['field'],
      siblingData: {} as unknown as Parameters<typeof populateOrderedBy>[0]['siblingData'],
      path: [] as unknown as Parameters<typeof populateOrderedBy>[0]['path'],
      schemaPath: [] as unknown as Parameters<typeof populateOrderedBy>[0]['schemaPath'],
      collection: undefined as unknown as Parameters<typeof populateOrderedBy>[0]['collection'],
      context: {} as unknown as Parameters<typeof populateOrderedBy>[0]['context'],
    })

    expect(result).toBe('some-value')
  })

  it('returns null when user has no id', async () => {
    const result = await populateOrderedBy({
      req: { user: { email: 'test@example.com' } } as unknown as Parameters<
        typeof populateOrderedBy
      >[0]['req'],
      operation: 'create',
      value: null,
      data: {} as unknown as Parameters<typeof populateOrderedBy>[0]['data'],
      originalDoc: undefined as unknown as Parameters<typeof populateOrderedBy>[0]['originalDoc'],
      field: {} as unknown as Parameters<typeof populateOrderedBy>[0]['field'],
      siblingData: {} as unknown as Parameters<typeof populateOrderedBy>[0]['siblingData'],
      path: [] as unknown as Parameters<typeof populateOrderedBy>[0]['path'],
      schemaPath: [] as unknown as Parameters<typeof populateOrderedBy>[0]['schemaPath'],
      collection: undefined as unknown as Parameters<typeof populateOrderedBy>[0]['collection'],
      context: {} as unknown as Parameters<typeof populateOrderedBy>[0]['context'],
    })

    // value is null (falsy), so it enters the branch; user.id is undefined -> returns undefined ?? null
    expect(result).toBeNull()
  })
})
