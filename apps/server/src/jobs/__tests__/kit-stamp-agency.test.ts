import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockInsertValues = vi.fn().mockResolvedValue(undefined);
const mockUpdateSet = vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) }));
const mockSelectLimit = vi.fn();

vi.mock('@revealui/db/client', () => ({
  getClient: () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: mockSelectLimit,
        }),
      }),
    }),
    insert: () => ({ values: mockInsertValues }),
    update: () => ({ set: mockUpdateSet }),
  }),
}));

vi.mock('../../lib/webhook-emails.js', () => ({
  sendAgencyKitPackageEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/kit-download-token.js', () => ({
  mintKitDownloadToken: vi.fn().mockReturnValue('signed.token'),
}));

import { kitStampAgencyHandler } from '../kit-stamp-agency.js';

describe('kitStampAgencyHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVEALUI_SECRET = 'test-secret';
    mockSelectLimit.mockResolvedValue([]);
  });

  it('creates fulfillment and marks ready with artifact', async () => {
    // first select: no existing; second select in email path N/A with empty user
    mockSelectLimit.mockResolvedValueOnce([]).mockResolvedValueOnce([{ email: 'buyer@ex.com' }]);

    const result = await kitStampAgencyHandler(
      {
        stripeEventId: 'evt_test_1',
        licenseId: 'lic_1',
        userId: 'user_1',
        customerId: 'cus_1',
        livemode: false,
        branding: { company: 'Buyer Co', email: 'buyer@ex.com' },
      },
      { id: 'job_1' } as never,
    );

    expect(result.status).toBe('ready');
    expect(result.fulfillmentId).toBeTruthy();
    expect(mockInsertValues).toHaveBeenCalled();
    expect(mockUpdateSet).toHaveBeenCalled();
  });

  it('short-circuits when already ready', async () => {
    mockSelectLimit.mockReset();
    mockSelectLimit.mockResolvedValue([
      {
        id: 'ful_existing',
        status: 'ready',
        artifact: { version: 1 },
      },
    ]);

    const result = await kitStampAgencyHandler(
      {
        stripeEventId: 'evt_test_2',
        licenseId: 'lic_1',
        userId: 'user_1',
        customerId: 'cus_1',
        livemode: false,
      },
      { id: 'job_2' } as never,
    );

    expect(result).toEqual({
      fulfillmentId: 'ful_existing',
      status: 'ready',
      deduplicated: true,
    });
    expect(mockInsertValues).not.toHaveBeenCalled();
  });
});
