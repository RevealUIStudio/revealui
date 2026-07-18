'use client';

/**
 * Edit-sessions list. Minimal: lists open sessions and links each to its canvas.
 * Auth is enforced centrally by `proxy.ts`.
 */

import Link from 'next/link';
import { type ReactElement, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/utils/csrf';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.revealui.com';

interface SessionRow {
  id: string;
  title: string;
  status: string;
  siteId: string;
}

export default function EditSessionsListPage(): ReactElement {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`${API_BASE_URL}/api/content/sessions?status=open`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error(`load failed: ${res.status}`);
        const body = (await res.json()) as { data: SessionRow[] };
        if (!cancelled) setSessions(body.data);
      } catch (err) {
        if (!cancelled) setError(String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="p-4">
      <h1 className="mb-4 text-lg font-semibold">Edit sessions</h1>
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
