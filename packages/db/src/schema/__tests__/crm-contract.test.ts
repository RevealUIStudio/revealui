import { getTableName } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import {
  crmActivities,
  crmCampaigns,
  crmContacts,
  crmOpportunities,
  crmOrganizations,
} from '../crm.js';
import { crmOutreachDrafts, crmStageHistory, crmSuppression, crmTasks } from '../crm-workflows.js';

describe('native CRM schema', () => {
  it('has nine distinct table names', () => {
    const tables = [
      crmOrganizations,
      crmContacts,
      crmOpportunities,
      crmActivities,
      crmCampaigns,
      crmTasks,
      crmOutreachDrafts,
      crmSuppression,
      crmStageHistory,
    ];
    expect(new Set(tables.map((table) => getTableName(table))).size).toBe(9);
  });

  it('does not reuse authenticated users as external contacts', () => {
    expect(getTableName(crmContacts)).toBe('crm_contacts');
  });
});
