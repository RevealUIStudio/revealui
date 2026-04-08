/**
 * Cart Cascade Delete Hook Tests
 *
 * Tests for hooks that remove items from user carts when prices/products are deleted:
 * - deletePriceFromCarts: removes a deleted price from all user carts
 * - deleteProductFromCarts: removes a deleted product from all user carts
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFind = vi.fn();
const mockUpdate = vi.fn();

// ─── deletePriceFromCarts ───────────────────────────────────────────────────────

describe('deletePriceFromCarts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function loadHook() {
    const mod = await import('../Prices/hooks/deletePriceFromCarts.js');
    return mod.deletePriceFromCarts;
  }

  function makeReq() {
    return { revealui: { find: mockFind, update: mockUpdate } } as never;
  }

  it('does nothing when req has no revealui instance', async () => {
    const hook = await loadHook();
    await hook({ req: {} as never, id: 'price-1' });
    expect(mockFind).not.toHaveBeenCalled();
  });

  it('does nothing when no users have the price in cart', async () => {
    mockFind.mockResolvedValue({ totalDocs: 0, docs: [] });
    const hook = await loadHook();

    await hook({ req: makeReq(), id: 'price-1' });

    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        overrideAccess: true,
        where: { 'cart.items.product': { equals: 'price-1' } },
      }),
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('removes the price from all user carts', async () => {
    mockFind.mockResolvedValue({
      totalDocs: 2,
      docs: [
        {
          id: 'user-1',
          cart: {
            items: [
              { product: 'price-1', quantity: 1 },
              { product: 'price-2', quantity: 3 },
            ],
          },
        },
        {
          id: 'user-2',
          cart: {
            items: [{ product: 'price-1', quantity: 2 }],
          },
        },
      ],
    });
    mockUpdate.mockResolvedValue({});

    const hook = await loadHook();
    await hook({ req: makeReq(), id: 'price-1' });

    expect(mockUpdate).toHaveBeenCalledTimes(2);
    // User 1: price-1 removed, price-2 kept
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        id: 'user-1',
      }),
    );
    // User 2: price-1 removed, cart empty
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        id: 'user-2',
      }),
    );
  });

  it('handles users with no cart items gracefully', async () => {
    mockFind.mockResolvedValue({
      totalDocs: 1,
      docs: [{ id: 'user-1', cart: undefined }],
    });
    mockUpdate.mockResolvedValue({});

    const hook = await loadHook();
    await hook({ req: makeReq(), id: 'price-1' });

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('uses Promise.allSettled so one failure does not block others', async () => {
    mockFind.mockResolvedValue({
      totalDocs: 2,
      docs: [
        { id: 'user-1', cart: { items: [{ product: 'price-1' }] } },
        { id: 'user-2', cart: { items: [{ product: 'price-1' }] } },
      ],
    });
    mockUpdate.mockRejectedValueOnce(new Error('update failed')).mockResolvedValueOnce({});

    const hook = await loadHook();
    // Should not throw even if one update fails
    await expect(hook({ req: makeReq(), id: 'price-1' })).resolves.toBeUndefined();
    expect(mockUpdate).toHaveBeenCalledTimes(2);
  });
});

// ─── deleteProductFromCarts ─────────────────────────────────────────────────────

describe('deleteProductFromCarts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function loadHook() {
    const mod = await import('../Products/hooks/deleteProductFromCarts.js');
    return mod.deleteProductFromCarts;
  }

  function makeReq() {
    return { revealui: { find: mockFind, update: mockUpdate } } as never;
  }

  it('does nothing when req has no revealui instance', async () => {
    const hook = await loadHook();
    await hook({ req: {} as never, id: 'prod-1' });
    expect(mockFind).not.toHaveBeenCalled();
  });

  it('does nothing when no users have the product in cart', async () => {
    mockFind.mockResolvedValue({ totalDocs: 0, docs: [] });
    const hook = await loadHook();

    await hook({ req: makeReq(), id: 'prod-1' });

    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        overrideAccess: true,
        where: { 'cart.items.product': { equals: 'prod-1' } },
      }),
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('removes the product from all user carts', async () => {
    mockFind.mockResolvedValue({
      totalDocs: 1,
      docs: [
        {
          id: 'user-1',
          cart: {
            items: [
              { product: 'prod-1', quantity: 1 },
              { product: 'prod-2', quantity: 2 },
            ],
          },
        },
      ],
    });
    mockUpdate.mockResolvedValue({});

    const hook = await loadHook();
    await hook({ req: makeReq(), id: 'prod-1' });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        id: 'user-1',
      }),
    );
  });

  it('handles users with missing cart items array', async () => {
    mockFind.mockResolvedValue({
      totalDocs: 1,
      docs: [{ id: 'user-1', cart: {} }],
    });

    const hook = await loadHook();
    await hook({ req: makeReq(), id: 'prod-1' });

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('uses Promise.allSettled for resilient batch updates', async () => {
    mockFind.mockResolvedValue({
      totalDocs: 2,
      docs: [
        { id: 'user-1', cart: { items: [{ product: 'prod-1' }] } },
        { id: 'user-2', cart: { items: [{ product: 'prod-1' }] } },
      ],
    });
    mockUpdate.mockRejectedValueOnce(new Error('db error')).mockResolvedValueOnce({});

    const hook = await loadHook();
    await expect(hook({ req: makeReq(), id: 'prod-1' })).resolves.toBeUndefined();
    expect(mockUpdate).toHaveBeenCalledTimes(2);
  });
});
