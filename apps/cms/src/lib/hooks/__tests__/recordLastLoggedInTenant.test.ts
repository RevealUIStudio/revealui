/**
 * Tests for recordLastLoggedInTenant hook
 *
 * Records which tenant a user last logged into based on the request host header.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { recordLastLoggedInTenant } from '../recordLastLoggedInTenant';

describe('recordLastLoggedInTenant', () => {
  const mockFind = vi.fn();
  const mockUpdate = vi.fn();
  const mockLogger = { error: vi.fn(), info: vi.fn() };

  function makeReq(host?: string) {
    return {
      revealui: {
        find: mockFind,
        update: mockUpdate,
        logger: mockLogger,
      },
      headers: host ? new Headers({ host }) : new Headers(),
    } as never;
  }

  const user = { id: 'user-1' } as never;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates user with tenant ID when host matches a tenant domain', async () => {
    mockFind.mockResolvedValue({ docs: [{ id: 'tenant-1' }] });
    mockUpdate.mockResolvedValue({});

    const result = await recordLastLoggedInTenant({
      req: makeReq('acme.revealui.com'),
      user,
    });

    expect(result).toBe(user);
    expect(mockFind).toHaveBeenCalledWith({
      collection: 'tenants',
      where: { 'domains.domain': { in: ['acme.revealui.com'] } },
      depth: 0,
      limit: 1,
    });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'user-1',
        collection: 'users',
        data: { lastLoggedInTenant: 'tenant-1' },
      }),
    );
  });

  it('sets lastLoggedInTenant to null when no tenant matches', async () => {
    mockFind.mockResolvedValue({ docs: [] });
    mockUpdate.mockResolvedValue({});

    await recordLastLoggedInTenant({
      req: makeReq('unknown.example.com'),
      user,
    });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { lastLoggedInTenant: null },
      }),
    );
  });

  it('returns user immediately when req has no revealui instance', async () => {
    const result = await recordLastLoggedInTenant({
      req: {} as never,
      user,
    });

    expect(result).toBe(user);
    expect(mockFind).not.toHaveBeenCalled();
  });

  it('returns user when host header is empty', async () => {
    const result = await recordLastLoggedInTenant({
      req: makeReq(),
      user,
    });

    expect(result).toBe(user);
    expect(mockFind).not.toHaveBeenCalled();
  });

  it('handles Record-style headers', async () => {
    mockFind.mockResolvedValue({ docs: [{ id: 'tenant-2' }] });
    mockUpdate.mockResolvedValue({});

    const req = {
      revealui: { find: mockFind, update: mockUpdate, logger: mockLogger },
      headers: { host: 'shop.revealui.com' },
    };

    await recordLastLoggedInTenant({ req: req as never, user });

    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { 'domains.domain': { in: ['shop.revealui.com'] } },
      }),
    );
  });

  it('logs error and returns user when find throws', async () => {
    mockFind.mockRejectedValue(new Error('DB connection failed'));

    const result = await recordLastLoggedInTenant({
      req: makeReq('acme.revealui.com'),
      user,
    });

    expect(result).toBe(user);
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('DB connection failed'));
  });

  it('logs error and returns user when update throws', async () => {
    mockFind.mockResolvedValue({ docs: [{ id: 'tenant-1' }] });
    mockUpdate.mockRejectedValue(new Error('update failed'));

    const result = await recordLastLoggedInTenant({
      req: makeReq('acme.revealui.com'),
      user,
    });

    expect(result).toBe(user);
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('update failed'));
  });
});
