import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateUserPurchases } from '@/lib/collections/Orders/hooks/updateUserPurchases';

describe('updateUserPurchases', () => {
  const mockFindByID = vi.fn();
  const mockUpdate = vi.fn();

  const createReq = () => ({
    revealui: {
      findByID: mockFindByID,
      update: mockUpdate,
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds new product IDs to user purchases on create', async () => {
    const user = { id: 'user-1', purchases: [] };
    mockFindByID.mockResolvedValue(user);
    mockUpdate.mockResolvedValue(user);

    const doc = {
      orderedBy: 'user-1',
      items: [{ product: 'prod-1' }, { product: 'prod-2' }],
    } as unknown as Parameters<typeof updateUserPurchases>[0]['doc'];

    const result = await updateUserPurchases({
      doc,
      req: createReq() as unknown as Parameters<typeof updateUserPurchases>[0]['req'],
      operation: 'create',
      previousDoc: undefined as unknown as Parameters<typeof updateUserPurchases>[0]['previousDoc'],
      collection: undefined as unknown as Parameters<typeof updateUserPurchases>[0]['collection'],
      context: {} as unknown as Parameters<typeof updateUserPurchases>[0]['context'],
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      collection: 'users',
      id: 'user-1',
      data: {
        purchases: expect.arrayContaining(['prod-1', 'prod-2']),
      },
    });
    expect(result).toEqual(doc);
  });

  it('merges new purchases with existing ones and deduplicates', async () => {
    const user = { id: 'user-1', purchases: ['prod-1', 'prod-3'] };
    mockFindByID.mockResolvedValue(user);
    mockUpdate.mockResolvedValue(user);

    const doc = {
      orderedBy: 'user-1',
      items: [{ product: 'prod-1' }, { product: 'prod-2' }],
    } as unknown as Parameters<typeof updateUserPurchases>[0]['doc'];

    await updateUserPurchases({
      doc,
      req: createReq() as unknown as Parameters<typeof updateUserPurchases>[0]['req'],
      operation: 'create',
      previousDoc: undefined as unknown as Parameters<typeof updateUserPurchases>[0]['previousDoc'],
      collection: undefined as unknown as Parameters<typeof updateUserPurchases>[0]['collection'],
      context: {} as unknown as Parameters<typeof updateUserPurchases>[0]['context'],
    });

    const updateCall = mockUpdate.mock.calls[0]?.[0];
    const purchases = updateCall.data.purchases as string[];
    expect(purchases).toHaveLength(3);
    expect(purchases).toContain('prod-1');
    expect(purchases).toContain('prod-2');
    expect(purchases).toContain('prod-3');
  });

  it('handles product references as objects with id', async () => {
    const user = { id: 'user-1', purchases: [] };
    mockFindByID.mockResolvedValue(user);
    mockUpdate.mockResolvedValue(user);

    const doc = {
      orderedBy: 'user-1',
      items: [{ product: { id: 'prod-obj-1' } }, { product: 'prod-str-1' }],
    } as unknown as Parameters<typeof updateUserPurchases>[0]['doc'];

    await updateUserPurchases({
      doc,
      req: createReq() as unknown as Parameters<typeof updateUserPurchases>[0]['req'],
      operation: 'create',
      previousDoc: undefined as unknown as Parameters<typeof updateUserPurchases>[0]['previousDoc'],
      collection: undefined as unknown as Parameters<typeof updateUserPurchases>[0]['collection'],
      context: {} as unknown as Parameters<typeof updateUserPurchases>[0]['context'],
    });

    const updateCall = mockUpdate.mock.calls[0]?.[0];
    const purchases = updateCall.data.purchases as string[];
    expect(purchases).toContain('prod-obj-1');
    expect(purchases).toContain('prod-str-1');
  });

  it('handles existing purchases as objects with id', async () => {
    const user = { id: 'user-1', purchases: [{ id: 'prod-existing' }] };
    mockFindByID.mockResolvedValue(user);
    mockUpdate.mockResolvedValue(user);

    const doc = {
      orderedBy: 'user-1',
      items: [{ product: 'prod-new' }],
    } as unknown as Parameters<typeof updateUserPurchases>[0]['doc'];

    await updateUserPurchases({
      doc,
      req: createReq() as unknown as Parameters<typeof updateUserPurchases>[0]['req'],
      operation: 'create',
      previousDoc: undefined as unknown as Parameters<typeof updateUserPurchases>[0]['previousDoc'],
      collection: undefined as unknown as Parameters<typeof updateUserPurchases>[0]['collection'],
      context: {} as unknown as Parameters<typeof updateUserPurchases>[0]['context'],
    });

    const updateCall = mockUpdate.mock.calls[0]?.[0];
    const purchases = updateCall.data.purchases as string[];
    expect(purchases).toContain('prod-existing');
    expect(purchases).toContain('prod-new');
  });

  it('works on update operation too', async () => {
    const user = { id: 'user-1', purchases: [] };
    mockFindByID.mockResolvedValue(user);
    mockUpdate.mockResolvedValue(user);

    const doc = {
      orderedBy: 'user-1',
      items: [{ product: 'prod-1' }],
    } as unknown as Parameters<typeof updateUserPurchases>[0]['doc'];

    await updateUserPurchases({
      doc,
      req: createReq() as unknown as Parameters<typeof updateUserPurchases>[0]['req'],
      operation: 'update',
      previousDoc: undefined as unknown as Parameters<typeof updateUserPurchases>[0]['previousDoc'],
      collection: undefined as unknown as Parameters<typeof updateUserPurchases>[0]['collection'],
      context: {} as unknown as Parameters<typeof updateUserPurchases>[0]['context'],
    });

    expect(mockFindByID).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('does nothing when revealui is not on req', async () => {
    const doc = {
      orderedBy: 'user-1',
      items: [{ product: 'prod-1' }],
    } as unknown as Parameters<typeof updateUserPurchases>[0]['doc'];

    const result = await updateUserPurchases({
      doc,
      req: {} as unknown as Parameters<typeof updateUserPurchases>[0]['req'],
      operation: 'create',
      previousDoc: undefined as unknown as Parameters<typeof updateUserPurchases>[0]['previousDoc'],
      collection: undefined as unknown as Parameters<typeof updateUserPurchases>[0]['collection'],
      context: {} as unknown as Parameters<typeof updateUserPurchases>[0]['context'],
    });

    expect(mockFindByID).not.toHaveBeenCalled();
    expect(result).toEqual(doc);
  });

  it('does nothing when orderedBy is missing', async () => {
    const doc = {
      items: [{ product: 'prod-1' }],
    } as unknown as Parameters<typeof updateUserPurchases>[0]['doc'];

    const result = await updateUserPurchases({
      doc,
      req: createReq() as unknown as Parameters<typeof updateUserPurchases>[0]['req'],
      operation: 'create',
      previousDoc: undefined as unknown as Parameters<typeof updateUserPurchases>[0]['previousDoc'],
      collection: undefined as unknown as Parameters<typeof updateUserPurchases>[0]['collection'],
      context: {} as unknown as Parameters<typeof updateUserPurchases>[0]['context'],
    });

    expect(mockFindByID).not.toHaveBeenCalled();
    expect(result).toEqual(doc);
  });

  it('does nothing when items is not an array', async () => {
    const doc = {
      orderedBy: 'user-1',
      items: 'not-an-array',
    } as unknown as Parameters<typeof updateUserPurchases>[0]['doc'];

    const result = await updateUserPurchases({
      doc,
      req: createReq() as unknown as Parameters<typeof updateUserPurchases>[0]['req'],
      operation: 'create',
      previousDoc: undefined as unknown as Parameters<typeof updateUserPurchases>[0]['previousDoc'],
      collection: undefined as unknown as Parameters<typeof updateUserPurchases>[0]['collection'],
      context: {} as unknown as Parameters<typeof updateUserPurchases>[0]['context'],
    });

    expect(mockFindByID).not.toHaveBeenCalled();
    expect(result).toEqual(doc);
  });

  it('does not update if user is not found', async () => {
    mockFindByID.mockResolvedValue(null);

    const doc = {
      orderedBy: 'user-999',
      items: [{ product: 'prod-1' }],
    } as unknown as Parameters<typeof updateUserPurchases>[0]['doc'];

    await updateUserPurchases({
      doc,
      req: createReq() as unknown as Parameters<typeof updateUserPurchases>[0]['req'],
      operation: 'create',
      previousDoc: undefined as unknown as Parameters<typeof updateUserPurchases>[0]['previousDoc'],
      collection: undefined as unknown as Parameters<typeof updateUserPurchases>[0]['collection'],
      context: {} as unknown as Parameters<typeof updateUserPurchases>[0]['context'],
    });

    expect(mockFindByID).toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('handles orderedBy as an object with toLocaleString', async () => {
    const user = { id: 'user-1', purchases: [] };
    mockFindByID.mockResolvedValue(user);
    mockUpdate.mockResolvedValue(user);

    const orderedByObj = { toLocaleString: () => 'user-obj-1' };
    const doc = {
      orderedBy: orderedByObj,
      items: [{ product: 'prod-1' }],
    } as unknown as Parameters<typeof updateUserPurchases>[0]['doc'];

    await updateUserPurchases({
      doc,
      req: createReq() as unknown as Parameters<typeof updateUserPurchases>[0]['req'],
      operation: 'create',
      previousDoc: undefined as unknown as Parameters<typeof updateUserPurchases>[0]['previousDoc'],
      collection: undefined as unknown as Parameters<typeof updateUserPurchases>[0]['collection'],
      context: {} as unknown as Parameters<typeof updateUserPurchases>[0]['context'],
    });

    expect(mockFindByID).toHaveBeenCalledWith({
      collection: 'users',
      id: 'user-obj-1',
    });
  });
});
