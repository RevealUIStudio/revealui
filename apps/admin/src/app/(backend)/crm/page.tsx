'use client';

import { useEffect, useState } from 'react';
import { parseCrmCsv } from '@/lib/crm/csv';
import { apiFetch } from '@/lib/utils/csrf';

type RecordRow = Record<string, unknown> & { id: string; version?: number };
const modules = [
  'organizations',
  'contacts',
  'opportunities',
  'activities',
  'tasks',
  'campaigns',
  'drafts',
  'suppression',
  'enrollments',
  'bookings',
  'imports',
  'dashboard',
] as const;
type Module = (typeof modules)[number];
type Field = { name: string; label: string; type?: string; required?: boolean; options?: string[] };
const fields: Partial<Record<Module, Field[]>> = {
  organizations: [
    { name: 'name', label: 'Organization', required: true },
    { name: 'website', label: 'Website', type: 'url' },
    { name: 'industry', label: 'Industry' },
    { name: 'location', label: 'Location' },
    { name: 'sourceUrl', label: 'Source URL', type: 'url', required: true },
  ],
  contacts: [
    { name: 'organizationId', label: 'Organization ID' },
    { name: 'name', label: 'Name' },
    { name: 'role', label: 'Role' },
    { name: 'businessEmail', label: 'Business email', type: 'email' },
    { name: 'contactSourceUrl', label: 'Contact source URL', type: 'url', required: true },
    {
      name: 'consent',
      label: 'Contact permission',
      options: ['unknown', 'permitted', 'withdrawn'],
    },
  ],
  opportunities: [
    { name: 'organizationId', label: 'Organization ID', required: true },
    { name: 'title', label: 'Opportunity', required: true },
    { name: 'offer', label: 'Offer', options: ['consultation', 'pilot', 'launch'] },
    { name: 'valueCents', label: 'Value in cents', type: 'number' },
    { name: 'ownerId', label: 'Owner user ID' },
    { name: 'nextActionAt', label: 'Next action', type: 'datetime-local' },
  ],
  activities: [
    { name: 'opportunityId', label: 'Opportunity ID', required: true },
    {
      name: 'kind',
      label: 'Activity',
      options: ['note', 'call', 'meeting', 'reply', 'proposal', 'outcome'],
    },
    { name: 'summary', label: 'Summary', type: 'textarea', required: true },
  ],
  tasks: [
    { name: 'opportunityId', label: 'Opportunity ID' },
    { name: 'title', label: 'Task', required: true },
    { name: 'assigneeId', label: 'Assignee user ID' },
    { name: 'dueAt', label: 'Due', type: 'datetime-local' },
  ],
  campaigns: [
    { name: 'name', label: 'Campaign', required: true },
    { name: 'template', label: 'Template', type: 'textarea' },
  ],
  drafts: [
    { name: 'contactId', label: 'Contact ID', required: true },
    { name: 'campaignId', label: 'Campaign ID' },
    { name: 'subject', label: 'Subject', required: true },
    { name: 'body', label: 'Draft', type: 'textarea', required: true },
    { name: 'evidence', label: 'Source URLs (one per line)', type: 'textarea', required: true },
  ],
  suppression: [
    { name: 'email', label: 'Email to suppress', type: 'email', required: true },
    { name: 'reason', label: 'Reason', required: true },
  ],
  enrollments: [
    { name: 'campaignId', label: 'Campaign ID', required: true },
    { name: 'contactId', label: 'Contact ID', required: true },
  ],
  bookings: [
    { name: 'opportunityId', label: 'Opportunity ID', required: true },
    { name: 'siteId', label: 'Private consultation site ID', required: true },
    { name: 'bookingId', label: 'Canonical booking ID', required: true },
  ],
};
const stages = [
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
];
const inputClass =
  'w-full rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-600';
const buttonClass =
  'rounded bg-zinc-900 px-3 py-2 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900';
export default function CrmPage() {
  const [account, setAccount] = useState('');
  const [activeAccount, setActiveAccount] = useState('');
  const [module, setModule] = useState<Module>('organizations');
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [report, setReport] = useState<{
    funnel: {
      stage: string;
      currency: string;
      count: number;
      pipelineCents: number;
      realizedRevenueCents: number;
    }[];
    overdueTasks: number;
    overdueFollowups: number;
    linkedBookings: number;
    activityCounts: { kind: string; count: number }[];
    draftCounts: { status: string; count: number }[];
  } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<RecordRow | null>(null);
  const [offset, setOffset] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [csv, setCsv] = useState('');
  const [importEntity, setImportEntity] = useState<'organizations' | 'contacts'>('organizations');
  const [preview, setPreview] = useState<unknown>(null);
  const [importRows, setImportRows] = useState<Record<string, unknown>[]>([]);
  const [importKey, setImportKey] = useState('');
  async function request(path: string, method = 'GET', body?: unknown) {
    const response = await apiFetch(`/api/crm/${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Account-ID': activeAccount },
      credentials: 'same-origin',
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? 'CRM request failed');
    return result.data;
  }
  useEffect(() => {
    if (!activeAccount) return;
    const controller = new AbortController();
    setBusy(true);
    setError('');
    setSelected(null);
    setRows([]);
    setReport(null);
    apiFetch(`/api/crm/${module}?${module === 'dashboard' ? '' : `limit=50&offset=${offset}`}`, {
      headers: { 'X-Account-ID': activeAccount },
      signal: controller.signal,
      cache: refresh >= 0 ? 'no-store' : 'default',
      credentials: 'same-origin',
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? 'CRM request failed');
        if (module === 'dashboard') setReport(result.data);
        else setRows(result.data);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : 'CRM unavailable');
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [activeAccount, module, offset, refresh]);
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await fn();
      setRefresh((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'CRM request failed');
    } finally {
      setBusy(false);
    }
  }
  async function create(form: HTMLFormElement) {
    const input: Record<string, unknown> = {};
    for (const field of fields[module] ?? []) {
      const value = new FormData(form).get(field.name)?.toString().trim();
      if (value)
        input[field.name] =
          field.name === 'evidence'
            ? value.split('\n').filter(Boolean)
            : field.type === 'number'
              ? Number(value)
              : field.type === 'datetime-local'
                ? new Date(value).toISOString()
                : value;
    }
    await run(async () => {
      if (selected && ['organizations', 'contacts', 'opportunities', 'drafts'].includes(module)) {
        if (module === 'opportunities') input.organizationId = undefined;
        if (module === 'drafts') {
          input.contactId = undefined;
          input.campaignId = undefined;
        }
        await request(`${module}/${selected.id}`, 'PATCH', { ...input, version: selected.version });
      } else await request(module, 'POST', input);
      form.reset();
    });
  }
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Studio CRM</h1>
        <p className="mt-1 text-zinc-500">
          Organizations, relationships, opportunities and follow-ups.
        </p>
      </header>
      <form
        className="flex max-w-lg gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setActiveAccount(account.trim());
          setOffset(0);
          setPreview(null);
          setImportRows([]);
        }}
      >
        <label className="flex-1">
          Account ID
          <input
            aria-label="Account ID"
            className={inputClass}
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            required
          />
        </label>
        <button className={buttonClass} type="submit" disabled={busy}>
          Open account
        </button>
      </form>
      {activeAccount && (
        <>
          <nav aria-label="CRM modules" className="flex flex-wrap gap-2">
            {modules.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={module === item}
                className={`rounded border px-3 py-2 ${module === item ? 'bg-zinc-200 dark:bg-zinc-700' : ''}`}
                onClick={() => {
                  setModule(item);
                  setOffset(0);
                }}
              >
                {item === 'opportunities'
                  ? 'Pipeline'
                  : item.charAt(0).toUpperCase() + item.slice(1)}
              </button>
            ))}
          </nav>
          {error && (
            <p role="alert" className="rounded border border-red-500 p-3">
              {error}
            </p>
          )}
          {busy && <p role="status">Working…</p>}
          {module === 'dashboard' && report !== null && (
            <section>
              <h2 className="text-xl font-semibold">Pipeline and follow-ups</h2>
              <pre className="overflow-auto rounded border p-4">
                {`Overdue tasks: ${report.overdueTasks}\nOverdue follow-ups: ${report.overdueFollowups}\nLinked bookings: ${report.linkedBookings}`}
              </pre>
              <table className="w-full text-left">
                <caption className="text-left font-semibold">Sales funnel</caption>
                <thead>
                  <tr>
                    <th>Stage</th>
                    <th>Count</th>
                    <th>Pipeline value</th>
                    <th>Reconciled revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {report.funnel.map((row) => (
                    <tr key={`${row.stage}-${row.currency}`}>
                      <td>{row.stage.replaceAll('_', ' ')}</td>
                      <td>{row.count}</td>
                      <td>
                        {row.currency} {(Number(row.pipelineCents) / 100).toFixed(2)}
                      </td>
                      <td>
                        {row.currency} {(Number(row.realizedRevenueCents) / 100).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>
                Pipeline value is an estimate. Realized revenue requires separately reconciled
                evidence.
              </p>
            </section>
          )}
          {module === 'bookings' && (
            <section className="space-y-3 rounded border p-4">
              <h2 className="text-lg font-semibold">Sync existing booking pipeline</h2>
              <p>
                Read the existing Studio booking and payment status into this opportunity. Booking,
                payment and fulfillment remain owned by the original flow.
              </p>
              <form
                className="grid gap-3 md:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const data = new FormData(e.currentTarget);
                  void run(() =>
                    request('bookings/sync', 'POST', {
                      opportunityId: data.get('opportunityId'),
                      bookingId: data.get('bookingId'),
                    }),
                  );
                }}
              >
                <label>
                  Opportunity ID
                  <input name="opportunityId" className={inputClass} required />
                </label>
                <label>
                  Existing booking ID
                  <input name="bookingId" className={inputClass} required />
                </label>
                <button className={buttonClass} type="submit" disabled={busy}>
                  Sync booking
                </button>
              </form>
            </section>
          )}
          {fields[module] && (
            <section className="rounded border p-4">
              <h2 className="mb-4 text-lg font-semibold">
                {module === 'bookings'
                  ? 'Link existing booking'
                  : module === 'suppression'
                    ? 'Record opt-out'
                    : `Add ${module}`}
              </h2>
              <form
                key={`${module}-${selected?.id ?? 'new'}`}
                className="grid gap-4 md:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void create(e.currentTarget);
                }}
              >
                {(fields[module] ?? []).map((field) => (
                  <label key={field.name} htmlFor={`crm-${field.name}`}>
                    {field.label}
                    {field.options ? (
                      <select
                        id={`crm-${field.name}`}
                        name={field.name}
                        className={inputClass}
                        defaultValue={selected ? String(selected[field.name] ?? '') : undefined}
                      >
                        {field.options.map((option) => (
                          <option key={option}>{option}</option>
                        ))}
                      </select>
                    ) : field.type === 'textarea' ? (
                      <textarea
                        id={`crm-${field.name}`}
                        name={field.name}
                        className={inputClass}
                        rows={4}
                        defaultValue={
                          selected
                            ? Array.isArray(selected[field.name])
                              ? (selected[field.name] as string[]).join('\n')
                              : String(selected[field.name] ?? '')
                            : undefined
                        }
                        required={field.required}
                      />
                    ) : (
                      <input
                        id={`crm-${field.name}`}
                        name={field.name}
                        className={inputClass}
                        type={field.type ?? 'text'}
                        defaultValue={
                          selected
                            ? field.type === 'datetime-local' && selected[field.name]
                              ? new Date(String(selected[field.name])).toISOString().slice(0, 16)
                              : String(selected[field.name] ?? '')
                            : undefined
                        }
                        required={field.required}
                        min={field.type === 'number' ? 0 : undefined}
                      />
                    )}
                  </label>
                ))}
                <div>
                  <button type="submit" disabled={busy} className={buttonClass}>
                    {selected ? 'Save changes' : module === 'drafts' ? 'Save draft' : 'Save'}
                  </button>
                </div>
              </form>
            </section>
          )}
          {module === 'imports' && (
            <section className="space-y-3 rounded border p-4">
              <h2 className="text-lg font-semibold">Import records</h2>
              <label>
                Import type
                <select
                  className={inputClass}
                  value={importEntity}
                  disabled={busy}
                  onChange={(e) => {
                    setImportEntity(e.target.value as 'organizations' | 'contacts');
                    setPreview(null);
                    setImportRows([]);
                  }}
                >
                  <option value="organizations">Organizations</option>
                  <option value="contacts">Contacts</option>
                </select>
              </label>
              <p>
                Contacts CSV: businessEmail and contactSourceUrl required; optional organizationId,
                name, role, consent. Existing suppression is always honored.
              </p>
              <p>
                CSV columns: name, website, industry, location, sourceUrl, sourceVerifiedAt. Name
                and sourceUrl are required.
              </p>
              <label className="block">
                CSV
                <textarea
                  className={inputClass}
                  rows={6}
                  value={csv}
                  onChange={(e) => {
                    setCsv(e.target.value);
                    setPreview(null);
                    setImportRows([]);
                  }}
                />
              </label>
              <button
                className={buttonClass}
                disabled={busy}
                type="button"
                onClick={() =>
                  void run(async () => {
                    const parsed = parseCrmCsv(csv, importEntity);
                    const proposed = await request(
                      importEntity === 'contacts' ? 'imports/contacts/preview' : 'imports/preview',
                      'POST',
                      { rows: parsed },
                    );
                    setImportRows(parsed);
                    setPreview(proposed);
                    setImportKey(crypto.randomUUID());
                  })
                }
              >
                Preview import
              </button>
              {preview !== null && (
                <>
                  <pre className="max-h-64 overflow-auto">{JSON.stringify(preview, null, 2)}</pre>
                  <button
                    className={buttonClass}
                    disabled={busy}
                    type="button"
                    onClick={() =>
                      void run(async () => {
                        await request(
                          importEntity === 'contacts'
                            ? 'imports/contacts/commit'
                            : 'imports/commit',
                          'POST',
                          {
                            rows: importRows,
                            idempotencyKey: importKey,
                          },
                        );
                        setPreview(null);
                        setCsv('');
                      })
                    }
                  >
                    Confirm import
                  </button>
                </>
              )}
            </section>
          )}
          {module === 'opportunities' && (
            <section aria-label="Pipeline" className="grid gap-3 md:grid-cols-3">
              {stages.map((stage) => (
                <div key={stage} className="rounded border p-3">
                  <h2 className="font-semibold">{stage.replaceAll('_', ' ')}</h2>
                  {rows
                    .filter((row) => row.stage === stage)
                    .map((row) => (
                      <button
                        type="button"
                        key={row.id}
                        onClick={() => setSelected(row)}
                        className="mt-2 block w-full rounded border p-3 text-left"
                      >
                        <strong>{String(row.title)}</strong>
                        <p>
                          {String(row.currency)} {(Number(row.valueCents) / 100).toFixed(2)}
                        </p>
                      </button>
                    ))}
                </div>
              ))}
            </section>
          )}
          {module !== 'dashboard' && (
            <section>
              <h2 className="mb-3 text-lg font-semibold">Records</h2>
              <div className="overflow-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr>
                      <th className="p-2">Name / title</th>
                      <th className="p-2">Status / stage</th>
                      <th className="p-2">Record ID</th>
                      <th className="p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="border-t">
                        <td className="p-2">
                          {String(
                            row.name ??
                              row.title ??
                              row.subject ??
                              row.normalizedEmail ??
                              row.bookingId ??
                              row.summary ??
                              row.id,
                          )}
                        </td>
                        <td className="p-2">{String(row.status ?? row.stage ?? '')}</td>
                        <td className="p-2">
                          <code>{row.id}</code>
                        </td>
                        <td className="p-2">
                          <button type="button" onClick={() => setSelected(row)}>
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!busy && rows.length === 0 && <p>No records yet.</p>}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={busy || offset === 0}
                  onClick={() => setOffset((v) => Math.max(0, v - 50))}
                >
                  Previous
                </button>
                <span>Page {offset / 50 + 1}</span>
                <button
                  type="button"
                  disabled={busy || rows.length < 50}
                  onClick={() => setOffset((v) => v + 50)}
                >
                  Next
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  const blob = new Blob([JSON.stringify(rows, null, 2)], {
                    type: 'application/json',
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `crm-${module}-page-${offset / 50 + 1}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Export this page
              </button>
            </section>
          )}
          {selected && (
            <section className="space-y-4 rounded border p-4" aria-label="Record details">
              <div className="flex justify-between">
                <h2 className="font-semibold">Record details</h2>
                <button type="button" onClick={() => setSelected(null)}>
                  Close
                </button>
              </div>
              <pre className="max-h-80 overflow-auto">{JSON.stringify(selected, null, 2)}</pre>
              {['organizations', 'contacts'].includes(module) && (
                <button
                  className={buttonClass}
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      request(`${module}/${selected.id}`, 'DELETE', { version: selected.version }),
                    )
                  }
                >
                  Archive record
                </button>
              )}
              {module === 'opportunities' && (
                <label>
                  Move stage
                  <select
                    aria-label="Move stage"
                    className={inputClass}
                    value={String(selected.stage)}
                    disabled={busy}
                    onChange={(e) =>
                      void run(() =>
                        request(`opportunities/${selected.id}/stage`, 'POST', {
                          stage: e.target.value,
                          version: selected.version,
                        }),
                      )
                    }
                  >
                    {stages.map((stage) => (
                      <option key={stage}>{stage}</option>
                    ))}
                  </select>
                </label>
              )}
              {module === 'opportunities' && (
                <form
                  className="space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const data = new FormData(e.currentTarget);
                    void run(() =>
                      request(`opportunities/${selected.id}/revenue`, 'POST', {
                        version: selected.version,
                        realizedRevenueCents: Number(data.get('realizedRevenueCents')),
                        revenueEvidence: data.get('revenueEvidence'),
                      }),
                    );
                  }}
                >
                  <label>
                    Reconciled revenue in cents
                    <input
                      className={inputClass}
                      name="realizedRevenueCents"
                      type="number"
                      min="0"
                      defaultValue={Number(selected.realizedRevenueCents ?? 0)}
                      required
                    />
                  </label>
                  <label>
                    Verified revenue evidence URL
                    <input
                      className={inputClass}
                      name="revenueEvidence"
                      type="url"
                      defaultValue={String(selected.revenueEvidence ?? '')}
                      required
                    />
                  </label>
                  <button className={buttonClass} type="submit" disabled={busy}>
                    Record reconciled revenue
                  </button>
                </form>
              )}
              {module === 'tasks' && (
                <button
                  className={buttonClass}
                  disabled={busy}
                  type="button"
                  onClick={() =>
                    void run(() =>
                      request(`tasks/${selected.id}`, 'PATCH', {
                        status: 'done',
                        version: selected.version,
                      }),
                    )
                  }
                >
                  Mark done
                </button>
              )}
              {module === 'campaigns' && (
                <label>
                  Campaign status
                  <select
                    aria-label="Campaign status"
                    className={inputClass}
                    value={String(selected.status)}
                    disabled={busy}
                    onChange={(e) =>
                      void run(() =>
                        request(`campaigns/${selected.id}`, 'PATCH', {
                          status: e.target.value,
                          version: selected.version,
                        }),
                      )
                    }
                  >
                    {['draft', 'review', 'approved', 'paused', 'archived'].map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </label>
              )}
              {module === 'drafts' && (
                <>
                  <p>Review the full draft and source references before approval.</p>
                  <button
                    className={buttonClass}
                    disabled={busy || selected.status !== 'draft'}
                    type="button"
                    onClick={() =>
                      void run(() =>
                        request(`drafts/${selected.id}/approve`, 'POST', {
                          version: selected.version,
                        }),
                      )
                    }
                  >
                    Approve reviewed draft
                  </button>
                </>
              )}
              {module === 'bookings' && (
                <div className="flex gap-2">
                  <button
                    className={buttonClass}
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void run(() =>
                        request('bookings/sync', 'POST', {
                          opportunityId: selected.opportunityId,
                          bookingId: selected.bookingId,
                        }),
                      )
                    }
                  >
                    Sync booking status
                  </button>
                  {Boolean(selected.siteId) && (
                    <button
                      className={buttonClass}
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void run(() => request(`bookings/${selected.id}/reconcile`, 'POST', {}))
                      }
                    >
                      Reconcile fulfillment
                    </button>
                  )}
                </div>
              )}
              {module === 'contacts' && (
                <button
                  className={buttonClass}
                  disabled={busy}
                  type="button"
                  onClick={() =>
                    void run(() => request('drafts/generate', 'POST', { contactId: selected.id }))
                  }
                >
                  Generate local AI draft
                </button>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}
