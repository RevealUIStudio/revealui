'use client';

/**
 * Edit-session canvas mount. Auth is enforced centrally by `proxy.ts` (the
 * `(backend)` group requires a session cookie), so this route is mount-only:
 * it unwraps the route id and renders the `@revealui/editor` canvas, injecting
 * the admin's CSRF-aware `apiFetch` and the API base URL. No editing logic lives
 * in the app; the canvas is the package component.
 */

import { EditSessionCanvas } from '@revealui/editor/canvas';
import { type ReactElement, use } from 'react';
import { apiFetch } from '@/lib/utils/csrf';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.revealui.com';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EditSessionPage({ params }: PageProps): ReactElement {
  const { id } = use(params);
  return (
    <div className="p-4" style={{ height: 'calc(100vh - 4rem)' }}>
      <EditSessionCanvas sessionId={id} apiBaseUrl={API_BASE_URL} fetcher={apiFetch} />
    </div>
  );
}
