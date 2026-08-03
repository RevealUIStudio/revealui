import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockInsertValues = vi.fn().mockResolvedValue(undefined);
const mockUpdateSet = vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) }));
const mockSelectLimit = vi.fn();
const mockUpload = vi.fn();

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@revealui/db/schema', () => ({
  kitFulfillments: {
    id: 'id',
    stripeEventId: 'stripe_event_id',
  },
  users: { id: 'id', email: 'email' },
}));

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

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ a, b })),
}));

vi.mock('../../lib/webhook-emails.js', () => ({
  sendAgencyKitPackageEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/kit-download-token.js', () => ({
  mintKitDownloadToken: vi.fn().mockReturnValue('signed.token'),
}));

vi.mock('../../lib/kit-stamp-storage.js', () => ({
  uploadAgencyKitTarball: (...args: unknown[]) => mockUpload(...args),
}));

import { kitStampAgencyHandler } from '../kit-stamp-agency.js';

describe('kitStampAgencyHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVEALUI_SECRET = 'test-secret';
    delete process.env.REVEALUI_KIT_STAMP_MODE;
    delete process.env.REVEALUI_KIT_STAMP_RUN;
    delete process.env.REVEALUI_REVFROGE_ROOT;
    mockSelectLimit.mockResolvedValue([]);
    mockUpload.mockResolvedValue({
      key: 'kits/test/x/y.tar.gz',
      url: 'https://media.example/kits/test/x/y.tar.gz',
      size: 100,
    });
  });

  it('creates fulfillment and marks ready with artifact (thin default)', async () => {
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
    expect(result.mode).toBe('thin');
    expect(result.fulfillmentId).toBeTruthy();
    expect(mockInsertValues).toHaveBeenCalled();
    expect(mockUpdateSet).toHaveBeenCalled();
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('full mode uploads tar.gz and sets artifact_uri', async () => {
    process.env.REVEALUI_KIT_STAMP_MODE = 'full';
    mockSelectLimit.mockResolvedValueOnce([]);

    const result = await kitStampAgencyHandler(
      {
        stripeEventId: 'evt_full_1',
        licenseId: 'lic_1',
        userId: 'user_1',
        customerId: 'cus_1',
        livemode: false,
        branding: { company: 'Buyer Co', email: 'buyer@ex.com', slug: 'buyer-co' },
      },
      { id: 'job_full' } as never,
    );

    expect(result.status).toBe('ready');
    expect(result.mode).toBe('full');
    expect(result.stampSource).toBe('package');
    expect(mockUpload).toHaveBeenCalledOnce();
    expect(mockUpload.mock.calls[0]?.[0]).toMatchObject({
      slug: 'buyer-co',
      livemode: false,
    });
    expect(Buffer.isBuffer(mockUpload.mock.calls[0]?.[0].body)).toBe(true);
    // last update should include artifactUri
    const readyCall = mockUpdateSet.mock.calls.find(
      (c) => c[0] && typeof c[0] === 'object' && (c[0] as { status?: string }).status === 'ready',
    );
    expect(readyCall?.[0]).toMatchObject({
      status: 'ready',
      artifactUri: 'https://media.example/kits/test/x/y.tar.gz',
    });
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

    expect(result.fulfillmentId).toBe('ful_existing');
    expect(result.status).toBe('ready');
    expect(result.deduplicated).toBe(true);
    expect(mockInsertValues).not.toHaveBeenCalled();
  });
});
