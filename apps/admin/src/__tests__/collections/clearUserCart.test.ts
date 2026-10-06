import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearUserCart } from '@/lib/collections/Orders/hooks/clearUserCart';

describe('clearUserCart', () => {
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

  it('clears the cart for the ordering user on create', async () => {
    const user = { id: 'user-1', email: 'test@example.com', cart: { items: [{ id: 'item-1' }] } };
    mockFindByID.mockResolvedValue(user);
    mockUpdate.mockResolvedValue({ ...user, cart: { items: [] } });

    const doc = { customerId: 'user-1', items: [] } as unknown as Parameters<
      typeof clearUserCart
    >[0]['doc'];

    const result = await clearUserCart({
      doc,
      req: createReq() as unknown as Parameters<typeof clearUserCart>[0]['req'],
      operation: 'create',
      previousDoc: undefined as unknown as Parameters<typeof clearUserCart>[0]['previousDoc'],
      collection: undefined as unknown as Parameters<typeof clearUserCart>[0]['collection'],
      context: {} as unknown as Parameters<typeof clearUserCart>[0]['context'],
    });

    expect(mockFindByID).toHaveBeenCalledWith({
      collection: 'users',
      id: 'user-1',
    });
    expect(mockUpdate).toHaveBeenCalledWith({
      collection: 'users',
      id: 'user-1',
      data: expect.objectContaining({
        cart: { items: [] },
      }),
    });
    expect(result).toEqual(doc);
  });

  it('uses the normalized customerId string', async () => {
    const user = { id: 'user-2', cart: { items: [{ id: 'item-2' }] } };
    mockFindByID.mockResolvedValue(user);
    mockUpdate.mockResolvedValue({ ...user, cart: { items: [] } });

    const doc = { customerId: 'user-2', items: [] } as unknown as Parameters<
      typeof clearUserCart
    >[0]['doc'];

    await clearUserCart({
      doc,
      req: createReq() as unknown as Parameters<typeof clearUserCart>[0]['req'],
      operation: 'create',
      previousDoc: undefined as unknown as Parameters<typeof clearUserCart>[0]['previousDoc'],
      collection: undefined as unknown as Parameters<typeof clearUserCart>[0]['collection'],
      context: {} as unknown as Parameters<typeof clearUserCart>[0]['context'],
    });

    expect(mockFindByID).toHaveBeenCalledWith({
      collection: 'users',
      id: 'user-2',
    });
  });

  it('does nothing on update operation', async () => {
    const doc = { customerId: 'user-1', items: [] } as unknown as Parameters<
      typeof clearUserCart
    >[0]['doc'];

    const result = await clearUserCart({
      doc,
      req: createReq() as unknown as Parameters<typeof clearUserCart>[0]['req'],
      operation: 'update',
      previousDoc: undefined as unknown as Parameters<typeof clearUserCart>[0]['previousDoc'],
      collection: undefined as unknown as Parameters<typeof clearUserCart>[0]['collection'],
      context: {} as unknown as Parameters<typeof clearUserCart>[0]['context'],
    });

    expect(mockFindByID).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(result).toEqual(doc);
  });

  it('rejects a missing customerId before side effects', async () => {
    const doc = { items: [] } as unknown as Parameters<typeof clearUserCart>[0]['doc'];

    await expect(
      clearUserCart({
        doc,
        req: createReq() as unknown as Parameters<typeof clearUserCart>[0]['req'],
        operation: 'create',
        previousDoc: undefined as unknown as Parameters<typeof clearUserCart>[0]['previousDoc'],
        collection: undefined as unknown as Parameters<typeof clearUserCart>[0]['collection'],
        context: {} as unknown as Parameters<typeof clearUserCart>[0]['context'],
      }),
    ).rejects.toThrow();

    expect(mockFindByID).not.toHaveBeenCalled();
  });

  it('does nothing when revealui is not available on req', async () => {
    const doc = { customerId: 'user-1', items: [] } as unknown as Parameters<
      typeof clearUserCart
    >[0]['doc'];

    const result = await clearUserCart({
      doc,
      req: {} as unknown as Parameters<typeof clearUserCart>[0]['req'],
      operation: 'create',
      previousDoc: undefined as unknown as Parameters<typeof clearUserCart>[0]['previousDoc'],
      collection: undefined as unknown as Parameters<typeof clearUserCart>[0]['collection'],
      context: {} as unknown as Parameters<typeof clearUserCart>[0]['context'],
    });

    expect(mockFindByID).not.toHaveBeenCalled();
    expect(result).toEqual(doc);
  });

  it('does not update if user is not found', async () => {
    mockFindByID.mockResolvedValue(null);

    const doc = { customerId: 'user-999', items: [] } as unknown as Parameters<
      typeof clearUserCart
    >[0]['doc'];

    const result = await clearUserCart({
      doc,
      req: createReq() as unknown as Parameters<typeof clearUserCart>[0]['req'],
      operation: 'create',
      previousDoc: undefined as unknown as Parameters<typeof clearUserCart>[0]['previousDoc'],
      collection: undefined as unknown as Parameters<typeof clearUserCart>[0]['collection'],
      context: {} as unknown as Parameters<typeof clearUserCart>[0]['context'],
    });

    expect(mockFindByID).toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(result).toEqual(doc);
  });
});
