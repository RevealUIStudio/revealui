import type { CollectionConfig } from '@revealui/core';
import { isAdmin } from '@/lib/access';

/**
 * Studio pipeline collection. Not a public CRM SKU and not Users.
 * Status is manual in admin. Contact-form success inserts a lead;
 * intros use INTRO_CALL_URL on the agency site (no Calendar OAuth).
 *
 * Select values stay in lockstep with `LEAD_STATUSES` / `LEAD_SOURCES`
 * in `packages/db/src/schema/leads.ts`. Do not import that module here —
 * collection config is loaded by the admin app.
 */
export const Leads: CollectionConfig = {
  slug: 'leads',
  mcpResource: false,
  labels: {
    singular: 'Lead',
    plural: 'Leads',
  },
  access: {
    create: isAdmin,
    read: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'company', 'source', 'status', 'created_at'],
    listSearchableFields: ['name', 'email', 'company'],
    description:
      'Studio pipeline only — not a public CRM. Filter the list by status. Intros use the existing Google Calendar Meet URL (INTRO_CALL_URL on the agency site). Do not add Calendar API scopes.',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'email',
      type: 'email',
      required: true,
    },
    {
      name: 'company',
      type: 'text',
    },
    {
      name: 'source',
      type: 'select',
      required: true,
      defaultValue: 'manual',
      options: [
        { label: 'Agency', value: 'agency' },
        { label: 'Marketing', value: 'marketing' },
        { label: 'Manual', value: 'manual' },
      ],
      admin: {
        position: 'sidebar',
        description: 'Which site or path created this lead. Contact forms set agency or marketing.',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'lead',
      options: [
        { label: 'Lead', value: 'lead' },
        { label: 'Intro booked', value: 'intro_booked' },
        { label: 'Intro done', value: 'intro_done' },
        { label: 'Pilot', value: 'pilot' },
        { label: 'Launch', value: 'launch' },
        { label: 'Closed', value: 'closed' },
      ],
      admin: {
        position: 'sidebar',
        description: 'Manual pipeline status. Update here only — no sequences or vendor sync.',
      },
    },
    {
      name: 'notes',
      type: 'textarea',
    },
    {
      name: 'intro_at',
      label: 'Intro at',
      type: 'date',
      admin: {
        position: 'sidebar',
        description:
          'When the intro is booked. Copy the existing Meet URL from INTRO_CALL_URL on the agency site.',
      },
    },
    {
      name: 'created_at',
      label: 'Created at',
      type: 'date',
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'updated_at',
      label: 'Updated at',
      type: 'date',
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
  ],
};
