import { describe, expect, it } from 'vitest';
import { Leads } from '../index';

describe('Leads collection', () => {
  it('registers as an admin-only leads slug, not Users', () => {
    expect(Leads.slug).toBe('leads');
    expect(Leads.mcpResource).toBe(false);
    expect(Leads.access?.create).toBeDefined();
    expect(Leads.access?.read).toBeDefined();
    expect(Leads.access?.update).toBeDefined();
    expect(Leads.access?.delete).toBeDefined();
  });

  it('lists and filters by status', () => {
    expect(Leads.admin?.defaultColumns).toContain('status');
    const status = Leads.fields.find((field) => 'name' in field && field.name === 'status');
    expect(status).toMatchObject({
      type: 'select',
      required: true,
      defaultValue: 'lead',
    });
    if (status && 'options' in status) {
      expect(status.options).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ value: 'lead' }),
          expect.objectContaining({ value: 'intro_booked' }),
          expect.objectContaining({ value: 'intro_done' }),
          expect.objectContaining({ value: 'pilot' }),
          expect.objectContaining({ value: 'launch' }),
          expect.objectContaining({ value: 'closed' }),
        ]),
      );
    }
  });

  it('points intros at the existing agency Meet URL', () => {
    expect(Leads.admin?.description).toContain('INTRO_CALL_URL');
    expect(Leads.admin?.description).toContain('Do not add Calendar API scopes');
  });
});
