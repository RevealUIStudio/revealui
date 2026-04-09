/**
 * Transaction Implementation Test - Critical Fix #1 Verification
 *
 * Verifies that withTransaction():
 * 1. Works correctly with pg Pool driver (Supabase/localhost)
 * 2. Throws clear error with Neon HTTP driver (no transaction support)
 *
 * This prevents data corruption in multi-step operations.
 *
 * @see docs/PRODUCTION_BLOCKERS.md - Critical Fix #1
 */

import { describe, expect, it, vi } from 'vitest';
import { withTransaction } from './client/index.js';
import type { Database } from './client/types.js';

describe('Critical Fix #1: Transaction Implementation', () => {
  describe('Neon HTTP Driver (no transaction support)', () => {
    const neonMockDb = {} as Database;

    it('throws error when withTransaction is called with Neon HTTP client', async () => {
      await expect(withTransaction(neonMockDb, async () => ({ success: true }))).rejects.toThrow(
        'Transaction not supported',
      );
    });

    it('error message mentions Neon HTTP driver limitation', async () => {
      try {
        await withTransaction(neonMockDb, async () => ({ success: true }));
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toContain('Neon HTTP driver');
        expect((error as Error).message).toContain('does not support transactions');
      }
    });

    it('error message suggests alternatives', async () => {
      try {
        await withTransaction(neonMockDb, async () => ({ success: true }));
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toContain('Supabase / localhost');
      }
    });

    it('error message references Neon HTTP driver limitation', async () => {
      try {
        await withTransaction(neonMockDb, async () => ({ success: true }));
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toContain('Neon HTTP driver');
      }
    });

    it('prevents payment flows without atomicity', async () => {
      // Simulate critical payment operation
      const processPayment = () =>
        withTransaction(neonMockDb, async () => {
          // These operations need atomicity:
          // 1. Create payment record
          // 2. Update user balance
          // 3. Send receipt
          return { paymentId: '123', success: true };
        });

      // Must throw to prevent data corruption
      await expect(processPayment()).rejects.toThrow('Transaction not supported');
    });

    it('prevents account creation without atomicity', async () => {
      // Simulate account creation
      const createAccount = () =>
        withTransaction(neonMockDb, async () => {
          // These operations need atomicity:
          // 1. Create user
          // 2. Create session
          // 3. Initialize settings
          return { userId: 'new-user-123' };
        });

      // Must throw to prevent partial account creation
      await expect(createAccount()).rejects.toThrow('Transaction not supported');
    });
  });

  describe('pg Pool Driver (transaction support)', () => {
    it('executes transaction with pg Pool client', async () => {
      const mockTxFn = vi.fn(async (callback: (tx: unknown) => Promise<string>) => {
        // Simulate transaction execution
        return callback({});
      });

      const pgMockDb = {
        transaction: mockTxFn,
      } as unknown as Database;

      const result = await withTransaction(pgMockDb, async () => {
        return 'success';
      });

      expect(result).toBe('success');
      expect(mockTxFn).toHaveBeenCalledTimes(1);
    });

    it('passes transaction context to callback', async () => {
      let capturedTx: unknown = null;

      const mockTxFn = vi.fn(async (callback: (tx: unknown) => Promise<void>) => {
        const txContext = { isTransaction: true };
        return callback(txContext);
      });

      const pgMockDb = {
        transaction: mockTxFn,
      } as unknown as Database;

      await withTransaction(pgMockDb, async (tx) => {
        capturedTx = tx;
      });

      expect(capturedTx).toEqual({ isTransaction: true });
    });

    it('propagates errors from transaction callback', async () => {
      const mockTxFn = vi.fn(async (callback: (tx: unknown) => Promise<never>) => {
        return callback({});
      });

      const pgMockDb = {
        transaction: mockTxFn,
      } as unknown as Database;

      await expect(
        withTransaction(pgMockDb, async () => {
          throw new Error('Transaction failed');
        }),
      ).rejects.toThrow('Transaction failed');
    });
  });
});

/**
 * Success Criteria:
 * ✅ All 9 tests passing = withTransaction works correctly for both drivers
 * ❌ Any test failing = Critical regression requiring immediate fix
 *
 * What This Verifies:
 * 1. Neon HTTP driver: Throws clear error (prevents silent failures)
 * 2. pg Pool driver: Executes transactions correctly
 * 3. Error messages are developer-friendly and actionable
 * 4. Prevents accidental use in critical operations (payments, auth)
 */
