import { describe, expect, it, vi } from 'vitest';
import { assertOwnerSlotAvailable, countOwners, OWNER_SOFT_CAP, OwnerSlotError } from './users.js';

function mockDbWithOwnerCount(total: number) {
  const where = vi.fn().mockResolvedValue([{ total }]);
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });
  return { select } as never;
}

describe('users queries  -  owner soft cap', () => {
  it('countOwners returns 0 when no owners exist', async () => {
    await expect(countOwners(mockDbWithOwnerCount(0))).resolves.toBe(0);
  });

  it('countOwners returns the total from the aggregate row', async () => {
    await expect(countOwners(mockDbWithOwnerCount(2))).resolves.toBe(2);
  });

  it('assertOwnerSlotAvailable passes when below the cap', async () => {
    await expect(assertOwnerSlotAvailable(mockDbWithOwnerCount(0))).resolves.toBeUndefined();
    await expect(
      assertOwnerSlotAvailable(mockDbWithOwnerCount(OWNER_SOFT_CAP - 1)),
    ).resolves.toBeUndefined();
  });

  it('assertOwnerSlotAvailable throws OwnerSlotError when cap is reached', async () => {
    const db = mockDbWithOwnerCount(OWNER_SOFT_CAP);
    await expect(assertOwnerSlotAvailable(db)).rejects.toBeInstanceOf(OwnerSlotError);
  });

  it('OwnerSlotError exposes current count and max for API surfacing', async () => {
    try {
      await assertOwnerSlotAvailable(mockDbWithOwnerCount(OWNER_SOFT_CAP));
      expect.fail('expected OwnerSlotError');
    } catch (err) {
      expect(err).toBeInstanceOf(OwnerSlotError);
      const e = err as OwnerSlotError;
      expect(e.code).toBe('OWNER_SLOT_EXHAUSTED');
      expect(e.currentCount).toBe(OWNER_SOFT_CAP);
      expect(e.max).toBe(OWNER_SOFT_CAP);
    }
  });

  it('honors a custom max when provided', async () => {
    await expect(assertOwnerSlotAvailable(mockDbWithOwnerCount(1), 1)).rejects.toBeInstanceOf(
      OwnerSlotError,
    );
    await expect(assertOwnerSlotAvailable(mockDbWithOwnerCount(0), 1)).resolves.toBeUndefined();
  });
});
