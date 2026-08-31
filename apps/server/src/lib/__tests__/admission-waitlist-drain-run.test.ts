import { describe, expect, it } from 'vitest';
import {
  isAdmissionWaitlistDrainEnabled,
  runAdmissionWaitlistDrain,
} from '../admission-waitlist-drain-run.js';

describe('isAdmissionWaitlistDrainEnabled', () => {
  it('is off by default / false', () => {
    expect(isAdmissionWaitlistDrainEnabled({})).toBe(false);
    expect(isAdmissionWaitlistDrainEnabled({ ADMISSION_WAITLIST_DRAIN_ENABLED: 'false' })).toBe(
      false,
    );
  });

  it('is on only when exactly true', () => {
    expect(isAdmissionWaitlistDrainEnabled({ ADMISSION_WAITLIST_DRAIN_ENABLED: 'true' })).toBe(
      true,
    );
    expect(isAdmissionWaitlistDrainEnabled({ ADMISSION_WAITLIST_DRAIN_ENABLED: '1' })).toBe(false);
  });
});

describe('runAdmissionWaitlistDrain', () => {
  it('skips when flag is off and does not expire', async () => {
    let called = 0;
    const result = await runAdmissionWaitlistDrain({
      env: {},
      expire: async () => {
        called += 1;
        return 3;
      },
    });
    expect(result).toEqual({
      skipped: true,
      reason: 'ADMISSION_WAITLIST_DRAIN_ENABLED not true',
    });
    expect(called).toBe(0);
  });

  it('expires when flag is on', async () => {
    const result = await runAdmissionWaitlistDrain({
      env: { ADMISSION_WAITLIST_DRAIN_ENABLED: 'true' },
      expire: async () => 2,
    });
    expect(result).toEqual({ skipped: false, expired: 2 });
  });
});
