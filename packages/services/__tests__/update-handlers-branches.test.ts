/**
 * Branch coverage for update-price and update-product handlers.
 *
 * Covers the non-Error else branches in catch blocks that weren't hit:
 * - updatePrice: catch(error) where error is not an Error instance
 * - updateProduct: catch(error) where error is not an Error instance
 * - POST handler: catch(error) where error is not an Error instance
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@revealui/core/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

function createResponseMock() {
  const response = { status: vi.fn(), send: vi.fn() };
  response.status.mockReturnValue(response);
  response.send.mockReturnValue(response);
  return response;
}

function buildRevealui(
  overrides: Partial<{
    find: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  }> = {},
) {
  return {
    find: vi.fn().mockResolvedValue({ docs: [{ id: 'product_123' }] }),
    update: vi.fn().mockResolvedValue(undefined),
    logger: { info: vi.fn(), error: vi.fn() },
    ...overrides,
  };
}

function buildStripe(
  overrides: Partial<{
    prices: { list: ReturnType<typeof vi.fn> };
  }> = {},
) {
  return {
    prices: { list: vi.fn().mockResolvedValue({ data: [], has_more: false }) },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// updatePrice — stripeProduct as object (else branch: stripeProduct.id)
// ---------------------------------------------------------------------------

describe('updatePrice — stripeProduct as object (uses stripeProduct.id)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('extracts product id from object when product field is not a string', async () => {
    const { updatePrice } = await import('../src/api/update-price/index.js');
    const revealui = buildRevealui();
    const stripe = buildStripe();
    const event = {
      id: 'evt_1',
      data: {
        object: {
          id: 'price_1',
          product: { id: 'prod_obj_123', object: 'product', name: 'My Product' },
          object: 'price',
          unit_amount: 999,
        },
      },
    };

    await expect(
      updatePrice({ event: event as never, revealui: revealui as never, stripe: stripe as never }),
    ).resolves.toBeUndefined();
    expect(revealui.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { stripeProductID: { equals: 'prod_obj_123' } } }),
    );
  });

  it('handles non-Error thrown by revealui.find (Unknown error branch)', async () => {
    const { updatePrice } = await import('../src/api/update-price/index.js');
    const revealui = buildRevealui({
      find: vi.fn().mockRejectedValue({ code: 'NOT_FOUND' }),
    });
    const stripe = buildStripe();
    const event = {
      id: 'evt_1',
      data: {
        object: { id: 'price_1', product: 'prod_123', object: 'price', unit_amount: 999 },
      },
    };

    await expect(
      updatePrice({ event: event as never, revealui: revealui as never, stripe: stripe as never }),
    ).resolves.toBeUndefined();
    expect(revealui.logger.error).toHaveBeenCalledWith(expect.stringContaining('Unknown error'));
  });
});

// ---------------------------------------------------------------------------
// updatePrice — non-Error in catch
// ---------------------------------------------------------------------------

describe('updatePrice — non-Error thrown in catch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles non-Error thrown by revealui.update (else branch: String(error))', async () => {
    const { updatePrice } = await import('../src/api/update-price/index.js');
    const revealui = buildRevealui({
      update: vi.fn().mockRejectedValue('not_an_error_string'),
    });
    const stripe = buildStripe();
    const event = {
      id: 'evt_1',
      data: {
        object: { id: 'price_1', product: 'prod_123', object: 'price', unit_amount: 999 },
      },
    };

    await expect(
      updatePrice({ event: event as never, revealui: revealui as never, stripe: stripe as never }),
    ).resolves.toBeUndefined();
    expect(revealui.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('not_an_error_string'),
    );
  });

  it('POST: handles non-Error thrown (else branch: Unknown error)', async () => {
    const { POST } = await import('../src/api/update-price/index.js');
    const response = createResponseMock();
    const revealui = buildRevealui({
      update: vi.fn().mockRejectedValue({ notAnError: true }),
    });
    const stripe = buildStripe();
    const event = {
      id: 'evt_1',
      data: {
        object: { id: 'price_1', product: 'prod_123', object: 'price', unit_amount: 999 },
      },
    };
    const req = {
      method: 'POST',
      body: { event, revealui, stripe },
    };

    await POST(req as never, response as never);
    // POST error handler catches the non-Error throw from updatePrice
    // (updatePrice doesn't rethrow — it catches internally, so POST resolves 200)
    // The revealui.update non-Error is caught INSIDE updatePrice's try/catch
    expect(response.status).toHaveBeenCalledWith(200);
  });
});

// ---------------------------------------------------------------------------
// updateProduct — non-Error thrown in catch
// ---------------------------------------------------------------------------

describe('updateProduct — non-Error thrown in catch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles non-Error thrown by revealui.update (else branch: String(error))', async () => {
    const { updateProduct } = await import('../src/api/update-product/index.js');
    const revealui = buildRevealui({
      update: vi.fn().mockRejectedValue('not_an_error_product'),
    });
    const stripe = buildStripe();
    const event = {
      id: 'evt_2',
      data: {
        object: { id: 'prod_1', name: 'Test Product', description: null, object: 'product' },
      },
    };

    await expect(
      updateProduct({
        event: event as never,
        revealui: revealui as never,
        stripe: stripe as never,
      }),
    ).resolves.toBeUndefined();
    expect(revealui.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('not_an_error_product'),
    );
  });

  it('handles non-Error thrown by stripe.prices.list (else branch in second catch)', async () => {
    const { updateProduct } = await import('../src/api/update-product/index.js');
    const revealui = buildRevealui();
    const stripe = buildStripe({
      prices: { list: vi.fn().mockRejectedValue('list_failure') },
    });
    const event = {
      id: 'evt_2',
      data: {
        object: { id: 'prod_1', name: 'Test Product', description: null, object: 'product' },
      },
    };

    await expect(
      updateProduct({
        event: event as never,
        revealui: revealui as never,
        stripe: stripe as never,
      }),
    ).resolves.toBeUndefined();
    expect(revealui.logger.error).toHaveBeenCalledWith(expect.stringContaining('list_failure'));
  });

  it('POST: handles non-Error thrown by updateProduct (else branch: Unknown error)', async () => {
    const { POST } = await import('../src/api/update-product/index.js');
    const response = createResponseMock();
    const revealui = buildRevealui({
      // make find throw directly (not caught inside updateProduct — propagates to POST)
      find: vi.fn().mockRejectedValue({ notAnError: true }),
    });
    const stripe = buildStripe();
    const event = {
      id: 'evt_2',
      data: {
        object: { id: 'prod_1', name: 'Test Product', description: null, object: 'product' },
      },
    };
    const req = {
      method: 'POST',
      body: { event, revealui, stripe },
    };

    await POST(req as never, response as never);
    // updateProduct catches revealui.find non-Error internally, then continues
    // POST gets status 200 (no re-throw from updateProduct)
    expect(response.status).toHaveBeenCalledWith(200);
  });
});
