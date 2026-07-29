import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RevealUILike } from '../bootstrap/index.js';
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
    expect(result.user?.id).toBe('new-user');
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

  it('does not send TOS fields through the engine create (callers persist them via typed write)', async () => {
    // Regression guard for the PR #458 breakage: tos_accepted_at / tos_version
    // are typed columns the injected engine's dynamic-SQL create() cannot
    // persist — it writes the literal camelCase keys as column names and the
    // universal-postgres identifier guard rejects `tosAcceptedAt`, failing the
    // whole admin creation. bootstrap() must keep these OUT of the engine create;
    // the callers stamp them via a typed Drizzle write
    // (apps/admin/src/lib/auth/tos.ts → stampTosAcceptanceByEmail).
    await bootstrap({
      revealui: mockRevealUI,
      admin: VALID_ADMIN,
    });

    const createCall = (mockRevealUI.create as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    const data = createCall?.data as Record<string, unknown>;

    expect(data).not.toHaveProperty('tosAcceptedAt');
    expect(data).not.toHaveProperty('tosVersion');
    // The role/roles dual-write must still be present.
    expect(data.role).toBe('owner');
    expect(data.roles).toEqual(['super-admin']);
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
