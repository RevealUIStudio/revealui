import { beforeEach, describe, expect, it, vi } from 'vitest';

const loggerErrorMock = vi.fn();

vi.mock('@revealui/core/utils/logger', () => ({
  logger: {
    error: loggerErrorMock,
  },
}));

function createResponseMock() {
  const response = {
    status: vi.fn(),
    send: vi.fn(),
  };

  response.status.mockReturnValue(response);
  response.send.mockReturnValue(response);

  return response;
}

describe('services sync API entrypoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updatePrice', () => {
    it('logs and returns early for an invalid price object', async () => {
      const { updatePrice } = await import('../src/api/update-price/index.js');
      const revealui = {
        find: vi.fn(),
        update: vi.fn(),
        logger: {
          info: vi.fn(),
          error: vi.fn(),
        },
      };
      const stripe = {
        prices: {
          list: vi.fn(),
        },
      };

      await updatePrice({
        event: {
          data: {
            object: {
              id: 'price_123',
            },
          },
        },
        revealui,
        stripe,
      });

      expect(revealui.logger.error).toHaveBeenCalledWith('Invalid price object in Stripe event');
      expect(revealui.find).not.toHaveBeenCalled();
      expect(stripe.prices.list).not.toHaveBeenCalled();
      expect(revealui.update).not.toHaveBeenCalled();
    });

    it('syncs Stripe prices to RevealUI', async () => {
      const { updatePrice } = await import('../src/api/update-price/index.js');
      const revealui = {
        find: vi.fn().mockResolvedValue({ docs: [{ id: 'product_123' }] }),
        update: vi.fn().mockResolvedValue(undefined),
        logger: {
          info: vi.fn(),
          error: vi.fn(),
        },
      };
      const stripePrices = {
        data: [{ id: 'price_123' }],
        has_more: false,
      };
      const stripe = {
        prices: {
          list: vi.fn().mockResolvedValue(stripePrices),
        },
      };

      await updatePrice({
        event: {
          data: {
            object: {
              id: 'price_123',
              product: 'prod_123',
            },
          },
        },
        revealui,
        stripe,
      });

      expect(revealui.find).toHaveBeenCalledWith({
        collection: 'products',
        where: {
          stripeProductID: {
            equals: 'prod_123',
          },
        },
      });
      expect(stripe.prices.list).toHaveBeenCalledWith({
        product: 'prod_123',
        limit: 100,
      });
      expect(revealui.update).toHaveBeenCalledWith({
        collection: 'products',
        id: 'product_123',
        data: {
          priceJSON: JSON.stringify(stripePrices),
          skipSync: true,
        },
      });
    });

    it('returns 405 for non-POST requests', async () => {
      const { POST } = await import('../src/api/update-price/index.js');
      const response = createResponseMock();

      await POST({ method: 'GET' } as never, response as never);

      expect(response.status).toHaveBeenCalledWith(405);
      expect(response.send).toHaveBeenCalledWith('Method Not Allowed');
    });

    it('returns 200 after syncing a POST request', async () => {
      const { POST } = await import('../src/api/update-price/index.js');
      const response = createResponseMock();
      const revealui = {
        find: vi.fn().mockResolvedValue({ docs: [{ id: 'product_123' }] }),
        update: vi.fn().mockResolvedValue(undefined),
        logger: {
          info: vi.fn(),
          error: vi.fn(),
        },
      };
      const stripe = {
        prices: {
          list: vi.fn().mockResolvedValue({ data: [], has_more: false }),
        },
      };

      await POST(
        {
          method: 'POST',
          body: {
            event: {
              data: {
                object: {
                  id: 'price_123',
                  product: 'prod_123',
                },
              },
            },
            revealui,
            stripe,
          },
        } as never,
        response as never,
      );

      expect(response.status).toHaveBeenCalledWith(200);
      expect(response.send).toHaveBeenCalledWith('Product updated successfully');
    });
  });

  describe('updateProduct', () => {
    it('syncs Stripe product metadata and prices to RevealUI', async () => {
      const { updateProduct } = await import('../src/api/update-product/index.js');
      const revealui = {
        find: vi.fn().mockResolvedValue({ docs: [{ id: 'product_123' }] }),
        update: vi.fn().mockResolvedValue(undefined),
        logger: {
          info: vi.fn(),
          error: vi.fn(),
        },
      };
      const stripePrices = {
        data: [{ id: 'price_123' }],
        has_more: false,
      };
      const stripe = {
        prices: {
          list: vi.fn().mockResolvedValue(stripePrices),
        },
      };

      await updateProduct({
        event: {
          data: {
            object: {
              id: 'prod_123',
              name: 'RevealUI Pro',
              description: 'Pro license',
            },
          },
        },
        revealui,
        stripe,
      });

      expect(revealui.find).toHaveBeenCalledWith({
        collection: 'products',
        where: {
          stripeProductID: {
            equals: 'prod_123',
          },
        },
      });
      expect(stripe.prices.list).toHaveBeenCalledWith({
        product: 'prod_123',
        limit: 100,
      });
      expect(revealui.update).toHaveBeenCalledWith({
        collection: 'products',
        id: 'product_123',
        data: {
          name: 'RevealUI Pro',
          description: 'Pro license',
          priceJSON: JSON.stringify(stripePrices),
          skipSync: true,
        },
      });
    });

    it('returns 405 for non-POST requests', async () => {
      const { POST } = await import('../src/api/update-product/index.js');
      const response = createResponseMock();

      await POST({ method: 'GET' } as never, response as never);

      expect(response.status).toHaveBeenCalledWith(405);
      expect(response.send).toHaveBeenCalledWith('Method Not Allowed');
    });

    it('returns 200 after syncing a POST request', async () => {
      const { POST } = await import('../src/api/update-product/index.js');
      const response = createResponseMock();
      const revealui = {
        find: vi.fn().mockResolvedValue({ docs: [{ id: 'product_123' }] }),
        update: vi.fn().mockResolvedValue(undefined),
        logger: {
          info: vi.fn(),
          error: vi.fn(),
        },
      };
      const stripe = {
        prices: {
          list: vi.fn().mockResolvedValue({ data: [], has_more: false }),
        },
      };

      await POST(
        {
          method: 'POST',
          body: {
            event: {
              data: {
                object: {
                  id: 'prod_123',
                  name: 'RevealUI Pro',
                  description: 'Pro license',
                },
              },
            },
            revealui,
            stripe,
          },
        } as never,
        response as never,
      );

      expect(response.status).toHaveBeenCalledWith(200);
      expect(response.send).toHaveBeenCalledWith('Product updated successfully');
    });
  });
});
