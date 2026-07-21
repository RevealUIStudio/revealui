'use client';

/**
 * Edit-sessions list + open form.
 *
 * Lists open sessions and opens a new session (site + title) via the Hono
 * content API, then navigates to the canvas. Auth is enforced centrally by
 * `proxy.ts` for the `(backend)` group.
 */

import { Button, Input, Select } from '@revealui/presentation';
import { Field, Label } from '@revealui/presentation/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, type ReactElement, useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/utils/csrf';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.revealui.com';

interface SessionRow {
  id: string;
  title: string;
  status: string;
  siteId: string;
}

interface SiteRow {
  id: string;
  name: string;
  slug: string;
}

export default function EditSessionsListPage(): ReactElement {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [siteId, setSiteId] = useState('');

  const loadSessions = useCallback(async (): Promise<void> => {
    const res = await apiFetch(`${API_BASE_URL}/api/content/sessions?status=open`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`load failed: ${res.status}`);
    const body = (await res.json()) as { data: SessionRow[] };
    setSessions(body.data);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [sessionsRes, sitesRes] = await Promise.all([
          apiFetch(`${API_BASE_URL}/api/content/sessions?status=open`, {
            credentials: 'include',
          }),
          apiFetch(`${API_BASE_URL}/api/content/sites?limit=50`, {
            credentials: 'include',
          }),
        ]);
        if (!sessionsRes.ok) throw new Error(`session list failed: ${sessionsRes.status}`);
        if (!sitesRes.ok) throw new Error(`site list failed: ${sitesRes.status}`);
        const sessionsBody = (await sessionsRes.json()) as { data: SessionRow[] };
        const sitesBody = (await sitesRes.json()) as { data: SiteRow[] };
        if (cancelled) return;
        setSessions(sessionsBody.data);
        setSites(sitesBody.data);
        // Prefer fleet-marketing when present; else first site.
        const preferred =
          sitesBody.data.find((s) => s.slug === 'fleet-marketing') ?? sitesBody.data[0];
        if (preferred) setSiteId(preferred.id);
      } catch (err) {
        if (!cancelled) setError(String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onCreate = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setCreateError(null);
    if (!siteId || title.trim().length === 0) {
      setCreateError('Pick a site and enter a session title.');
      return;
    }
    setCreating(true);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/content/sessions`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ siteId, title: title.trim() }),
      });
      if (!res.ok) {
        setCreateError(`Could not open session (${res.status}).`);
        return;
      }
      const body = (await res.json()) as { data: { id: string } };
      router.push(`/edit-sessions/${body.data.id}`);
    } catch (err) {
      setCreateError(String(err));
    } finally {
      setCreating(false);
      void loadSessions().catch(() => {
        /* list refresh is best-effort after create */
      });
    }
  };

  return (
    <div className="p-4">
      <h1 className="mb-4 text-lg font-semibold">Edit sessions</h1>

      <form
        onSubmit={onCreate}
        className="mb-8 max-w-lg space-y-3 rounded-md border border-neutral-800 p-4"
        aria-label="Open a new edit session"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Open session
        </h2>
        <Field>
          <Label className="block text-sm text-neutral-300">Site</Label>
          <Select
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            required
            className="mt-1"
          >
            {sites.length === 0 ? <option value="">No sites available</option> : null}
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.slug})
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <Label className="block text-sm text-neutral-300">Title</Label>
          <Input
            type="text"
            className="mt-1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Homepage copy pass"
            maxLength={500}
            required
          />
        </Field>
        {createError ? (
          <p role="alert" className="text-sm text-red-400">
            {createError}
          </p>
        ) : null}
        <Button type="submit" disabled={creating || sites.length === 0} size="sm">
          {creating ? 'Opening…' : 'Open session'}
        </Button>
      </form>

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-400">
        Open sessions
      </h2>
      {error ? (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      ) : null}
      {sessions.length === 0 ? (
        <p className="text-sm text-neutral-500">No open sessions.</p>
      ) : (
        <ul className="space-y-1">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link
                className="text-sm text-blue-400 hover:underline"
                href={`/edit-sessions/${s.id}`}
              >
                {s.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
