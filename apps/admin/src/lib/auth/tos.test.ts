import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_TOS_VERSION, getTosAcceptance, stampTosAcceptanceByEmail } from './tos';

describe('getTosAcceptance', () => {
  const prevTosVersion = process.env.TOS_VERSION;

  afterEach(() => {
    if (prevTosVersion === undefined) delete process.env.TOS_VERSION;
    else process.env.TOS_VERSION = prevTosVersion;
  });

  it('returns the default version and a fresh acceptance timestamp', () => {
    delete process.env.TOS_VERSION;

    const before = Date.now();
    const { tosAcceptedAt, tosVersion } = getTosAcceptance();
    const after = Date.now();

    expect(tosVersion).toBe(DEFAULT_TOS_VERSION);
    expect(tosAcceptedAt).toBeInstanceOf(Date);
    expect(tosAcceptedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(tosAcceptedAt.getTime()).toBeLessThanOrEqual(after);
  });

  it('honors the TOS_VERSION env override when present', () => {
    process.env.TOS_VERSION = '2099-01-01';
    expect(getTosAcceptance().tosVersion).toBe('2099-01-01');
  });
});

describe('stampTosAcceptanceByEmail', () => {
  it('issues a typed update setting tosAcceptedAt + tosVersion for the email', async () => {
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));
    // Minimal Drizzle-shaped stub; we only exercise update().set().where().
    const db = { update } as unknown as Parameters<typeof stampTosAcceptanceByEmail>[0];

    await stampTosAcceptanceByEmail(db, 'admin@test.com');

    expect(update).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        tosAcceptedAt: expect.any(Date),
        tosVersion: expect.any(String),
      }),
    );
    expect(where).toHaveBeenCalledTimes(1);
  });
});
