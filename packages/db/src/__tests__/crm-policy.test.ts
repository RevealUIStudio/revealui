import { describe, expect, it } from 'vitest';
import { canQueueOutreach, canTransitionCrmStage, isCrmStage } from '../crm-policy.js';

describe('native CRM policy', () => {
  it('accepts known stages only', () => {
    expect(isCrmStage('qualified')).toBe(true);
    expect(isCrmStage('invented')).toBe(false);
  });

  it('does not skip straight from research to won', () => {
    expect(canTransitionCrmStage('research', 'won')).toBe(false);
    expect(canTransitionCrmStage('proposal', 'won')).toBe(true);
  });

  it('never queues suppressed or unapproved messages', () => {
    const approved = {
      status: 'approved' as const,
      approvedBy: 'owner',
      approvedAt: new Date(),
      doNotContact: false,
      isSuppressed: false,
    };
    expect(canQueueOutreach(approved)).toBe(true);
    expect(canQueueOutreach({ ...approved, isSuppressed: true })).toBe(false);
    expect(canQueueOutreach({ ...approved, doNotContact: true })).toBe(false);
    expect(canQueueOutreach({ ...approved, approvedBy: null })).toBe(false);
    expect(canQueueOutreach({ ...approved, status: 'draft' })).toBe(false);
  });
});
