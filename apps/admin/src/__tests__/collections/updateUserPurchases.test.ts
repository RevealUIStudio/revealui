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
      customerId: 'user-1',
      items: [
        { productId: 'prod-1', title: 'One', quantity: 1, priceInCents: 100 },
        { productId: 'prod-2', title: 'Two', quantity: 1, priceInCents: 200 },
      ],
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
      customerId: 'user-1',
      items: [
        { productId: 'prod-1', title: 'One', quantity: 1, priceInCents: 100 },
        { productId: 'prod-2', title: 'Two', quantity: 1, priceInCents: 200 },
      ],
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

  it('uses normalized product ID fields', async () => {
    const user = { id: 'user-1', purchases: [] };
    mockFindByID.mockResolvedValue(user);
    mockUpdate.mockResolvedValue(user);

    const doc = {
      customerId: 'user-1',
      items: [
        { productId: 'prod-obj-1', title: 'Object product', quantity: 1, priceInCents: 100 },
        { productId: 'prod-str-1', title: 'String product', quantity: 1, priceInCents: 200 },
      ],
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
      customerId: 'user-1',
      items: [{ productId: 'prod-new', title: 'New', quantity: 1, priceInCents: 100 }],
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
      customerId: 'user-1',
      items: [{ productId: 'prod-1', title: 'One', quantity: 1, priceInCents: 100 }],
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
      customerId: 'user-1',
      items: [{ productId: 'prod-1', title: 'One', quantity: 1, priceInCents: 100 }],
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

  it('does nothing when customerId is missing', async () => {
    const doc = {
      items: [{ productId: 'prod-1', title: 'One', quantity: 1, priceInCents: 100 }],
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

  it('rejects invalid order items before side effects', async () => {
    const doc = {
      customerId: 'user-1',
      items: 'not-an-array',
    } as unknown as Parameters<typeof updateUserPurchases>[0]['doc'];

    await expect(
      updateUserPurchases({
        doc,
        req: createReq() as unknown as Parameters<typeof updateUserPurchases>[0]['req'],
        operation: 'create',
        previousDoc: undefined as unknown as Parameters<
          typeof updateUserPurchases
        >[0]['previousDoc'],
        collection: undefined as unknown as Parameters<typeof updateUserPurchases>[0]['collection'],
        context: {} as unknown as Parameters<typeof updateUserPurchases>[0]['context'],
      }),
    ).rejects.toThrow();

    expect(mockFindByID).not.toHaveBeenCalled();
  });

  it('does not update if user is not found', async () => {
    mockFindByID.mockResolvedValue(null);

    const doc = {
      customerId: 'user-999',
      items: [{ productId: 'prod-1', title: 'One', quantity: 1, priceInCents: 100 }],
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

  it('uses the normalized customerId string', async () => {
    const user = { id: 'user-1', purchases: [] };
    mockFindByID.mockResolvedValue(user);
    mockUpdate.mockResolvedValue(user);

    const doc = {
      customerId: 'user-obj-1',
      items: [{ productId: 'prod-1', title: 'One', quantity: 1, priceInCents: 100 }],
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
