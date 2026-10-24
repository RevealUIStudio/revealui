/** Pure native CRM workflow policy. Database writes and auth remain server-side. */
export const CRM_STAGES = [
  'research',
  'qualified',
  'contact_ready',
  'contacted',
  'replied',
  'discovery',
  'proposal',
  'won',
  'lost',
  'nurture',
  'do_not_contact',
] as const;

export type CrmStage = (typeof CRM_STAGES)[number];

const allowed: Record<CrmStage, readonly CrmStage[]> = {
  research: ['qualified', 'nurture', 'do_not_contact'],
  qualified: ['contact_ready', 'nurture', 'do_not_contact'],
  contact_ready: ['contacted', 'nurture', 'do_not_contact'],
  contacted: ['replied', 'nurture', 'do_not_contact'],
  replied: ['discovery', 'nurture', 'do_not_contact'],
  discovery: ['proposal', 'nurture', 'lost', 'do_not_contact'],
  proposal: ['won', 'lost', 'nurture', 'do_not_contact'],
  won: [],
  lost: ['nurture'],
  nurture: ['qualified', 'contact_ready', 'do_not_contact'],
  do_not_contact: [],
};

export function isCrmStage(value: string): value is CrmStage {
  return (CRM_STAGES as readonly string[]).includes(value);
}

export function canTransitionCrmStage(from: CrmStage, to: CrmStage): boolean {
  return allowed[from].includes(to);
}

/** Approval is necessary but not sufficient for sending; recheck suppression at send time. */
export function canQueueOutreach(input: {
  status: 'draft' | 'approved' | 'sent' | 'cancelled';
  approvedBy: string | null;
  approvedAt: Date | null;
  doNotContact: boolean;
  isSuppressed: boolean;
}): boolean {
  return (
    input.status === 'approved' &&
    input.approvedBy !== null &&
    input.approvedAt !== null &&
    !input.doNotContact &&
    !input.isSuppressed
  );
}
