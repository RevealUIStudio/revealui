import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BootstrapOptions, RevealUILike } from '../bootstrap/index.js';
import { bootstrap } from '../bootstrap/index.js';

function createMockRevealUI(options?: { hasUsers?: boolean }): RevealUILike {
  return {
    find: vi.fn().mockResolvedValue({
      totalDocs: options?.hasUsers ? 1 : 0,
      docs: options?.hasUsers ? [{ id: '1', email: 'existing@test.com' }] : [],
    }),
    create: vi.fn().mockResolvedValue({ id: 'new-user', email: 'admin@test.com' }),
  };
}

const VALID_ADMIN = {
  email: 'admin@test.com',
  password: 'securepassword123',
  name: 'Test Admin',
};

describe('bootstrap', () => {
  let mockRevealUI: RevealUILike;

  beforeEach(() => {
    mockRevealUI = createMockRevealUI();
  });

  it('creates admin user and seeds content on fresh instance', async () => {
    const result = await bootstrap({
      revealui: mockRevealUI,
      admin: VALID_ADMIN,
    });

    expect(result.status).toBe('created');
    expect(result.user?.email).toBe('admin@test.com');
    expect(result.user?.role).toBe('owner');
    expect(result.seeded).toBe(true);

    // Verify user was created with both the DB role and Payload roles array.
    // DB `role` column uses the Drizzle enum (CHECK-constrained); Payload
    // `roles` array uses the application taxonomy. These are different layers.
    expect(mockRevealUI.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        data: expect.objectContaining({
          email: 'admin@test.com',
          role: 'owner',
          roles: ['super-admin'],
        }),
      }),
    );
  });

  it('returns locked when users already exist', async () => {
    const existing = createMockRevealUI({ hasUsers: true });

    const result = await bootstrap({
      revealui: existing,
      admin: VALID_ADMIN,
    });

    expect(result.status).toBe('locked');
    expect(existing.create).not.toHaveBeenCalled();
  });

  it('returns error when database is unreachable', async () => {
    const broken: RevealUILike = {
      find: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      create: vi.fn(),
    };

    const result = await bootstrap({
      revealui: broken,
      admin: VALID_ADMIN,
    });

    expect(result.status).toBe('error');
    expect(result.message).toContain('Database connection failed');
    expect(result.error).toContain('ECONNREFUSED');
  });

  it('validates email is required', async () => {
    const result = await bootstrap({
      revealui: mockRevealUI,
      admin: { email: '', password: 'securepassword123' },
    });

    expect(result.status).toBe('error');
    expect(result.message).toContain('required');
  });

  it('validates password minimum length', async () => {
    const result = await bootstrap({
      revealui: mockRevealUI,
      admin: { email: 'admin@test.com', password: 'short' },
    });

    expect(result.status).toBe('error');
    expect(result.message).toContain('12 characters');
  });

  it('handles duplicate user gracefully', async () => {
    const dup: RevealUILike = {
      find: vi.fn().mockResolvedValue({ totalDocs: 0, docs: [] }),
      create: vi
        .fn()
        .mockRejectedValue(Object.assign(new Error('unique_violation'), { code: '23505' })),
    };

    const result = await bootstrap({
      revealui: dup,
      admin: VALID_ADMIN,
    });

    expect(result.status).toBe('error');
    expect(result.message).toContain('already exists');
  });

  it('skips seeding when seed=false', async () => {
    const result = await bootstrap({
      revealui: mockRevealUI,
      admin: VALID_ADMIN,
      seed: false,
    });

    expect(result.status).toBe('created');
    expect(result.seeded).toBe(false);
    // Only the user creation call, no page creation
    expect(mockRevealUI.create).toHaveBeenCalledTimes(1);
  });

  it('uses default name when not provided', async () => {
    await bootstrap({
      revealui: mockRevealUI,
      admin: { email: 'admin@test.com', password: 'securepassword123' },
    });

    expect(mockRevealUI.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Admin' }),
      }),
    );
  });

  it('continues even if seed fails (non-fatal)', async () => {
    const seedFails: RevealUILike = {
      find: vi
        .fn()
        .mockResolvedValueOnce({ totalDocs: 0, docs: [] }) // user check
        .mockRejectedValue(new Error('seed failure')), // page check fails
      create: vi.fn().mockResolvedValue({ id: '1' }),
    };

    const result = await bootstrap({
      revealui: seedFails,
      admin: VALID_ADMIN,
    });

    expect(result.status).toBe('created');
    expect(result.seeded).toBe(false); // seed failed but user was created
  });
});
