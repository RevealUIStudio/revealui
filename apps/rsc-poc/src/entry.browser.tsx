/**
 * Browser entry — hydrate from `__RSC_PAYLOAD__`, soft-nav via router-owned RSC
 * fetch (Phase 2.2.3 / ADR D3). No History monkey-patch; no local click listener.
 */
'use client';

import {
  ErrorBoundary,
  getRouterRedirect,
  Link,
  RouterProvider,
  useNavigationError,
  useNavigationStatus,
  useRscPayload,
} from '@revealui/router';
import { RSC_ACCEPT } from '@revealui/router/core';
import {
  createFromFetch,
  createFromReadableStream,
  createTemporaryReferenceSet,
  encodeReply,
  setServerCallback,
} from '@vitejs/plugin-rsc/browser';
import React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { createAppRouter } from './app-router.ts';
import type { RscPayload } from './entry.rsc.tsx';
import {
  initRscPocBrowserObservability,
  reportClientRenderError,
} from './observability/browser.ts';
import { ErrorFallback } from './pages/error-fallback.tsx';

const router = createAppRouter();

async function main(): Promise<void> {
  initRscPocBrowserObservability();

  router.setRscPayloadLoader(async (url, signal) => {
    const res = await fetch(url, {
      headers: { accept: RSC_ACCEPT },
      signal,
    });
    // Soft-nav hit a controlled 500 JSON body (2.3.2) — surface via navigation error.
    if (res.status >= 500 && res.headers.get('X-Router-Error') === '1') {
      const body = (await res.json()) as { message?: string };
      throw new Error(body.message ?? 'Navigation failed');
    }
    if (!res.ok) {
      throw new Error(`Navigation failed (${res.status})`);
    }
    return createFromFetch<RscPayload>(Promise.resolve(res));
  });

  const rscBase64 = (globalThis as Record<string, unknown>).__RSC_PAYLOAD__ as string | undefined;

  let initialPayload: RscPayload;
  if (rscBase64) {
    const rscBytes = Uint8Array.from(atob(rscBase64), (c) => c.charCodeAt(0));
    const rscStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(rscBytes);
        controller.close();
      },
    });
    initialPayload = await createFromReadableStream<RscPayload>(rscStream);
  } else {
    initialPayload = await createFromFetch<RscPayload>(
      fetch(window.location.href, { headers: { accept: RSC_ACCEPT } }),
    );
  }

  router.seedCurrentMatch(router.match(window.location.pathname));
  router.applyRscPayload(initialPayload);
  router.initClient();

  function BrowserRoot(): React.ReactNode {
    const payload = useRscPayload<RscPayload>();
    const status = useNavigationStatus();
    const navError = useNavigationError();

    if (!payload) {
      return <div>Loading…</div>;
    }

    return (
      <>
        {status === 'loading' ? (
          <div
            data-router-nav="loading"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              height: 2,
              background: '#3b82f6',
              zIndex: 50,
            }}
          />
        ) : null}
        {status === 'error' && navError ? (
          <div
            data-router-nav="error"
            style={{
              padding: '8px 16px',
              background: '#fef2f2',
              borderBottom: '1px solid #fecaca',
              color: '#991b1b',
            }}
          >
            Navigation failed: {navError.message} <Link to={window.location.pathname}>Retry</Link>
            {' · '}
            <Link to="/">Home</Link>
          </div>
        ) : null}
        <ErrorBoundary
          fallback={ErrorFallback}
          onError={reportClientRenderError}
          resetKey={
            typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/'
          }
        >
          {payload.root}
        </ErrorBoundary>
      </>
    );
  }

  setServerCallback(async (id: string, args: unknown[]) => {
    const temporaryReferences = createTemporaryReferenceSet();
    const body = await encodeReply(args, { temporaryReferences });
    const headers: Record<string, string> = {
      'x-rsc-action': id,
      accept: RSC_ACCEPT,
    };
    if (typeof body === 'string') {
      headers['content-type'] = 'text/plain;charset=UTF-8';
    }
    const response = await fetch(window.location.href, {
      method: 'POST',
      headers,
      body: body as BodyInit,
    });
    // redirect() from action → X-Router-Redirect (ADR D6 / 2.2.4).
    const redirectTo = getRouterRedirect(response);
    if (redirectTo) {
      router.navigate(redirectTo);
      return undefined;
    }
    const payload = await createFromFetch<RscPayload>(Promise.resolve(response), {
      temporaryReferences,
    });
    // Action already returned a fresh tree — apply without a second GET.
    router.applyRscPayload(payload);
    const rv = payload.returnValue;
    if (!rv) return undefined;
    if (!rv.ok) throw rv.data;
    return rv.data;
  });

  const browserRoot = (
    <React.StrictMode>
      <RouterProvider router={router}>
        <BrowserRoot />
      </RouterProvider>
    </React.StrictMode>
  );

  const mountEl = document.getElementById('root');
  if (mountEl && rscBase64) {
    hydrateRoot(document, browserRoot, { formState: initialPayload.formState });
  } else if (mountEl) {
    createRoot(mountEl).render(browserRoot);
  } else {
    hydrateRoot(document, browserRoot, { formState: initialPayload.formState });
  }

  if (import.meta.hot) {
    import.meta.hot.on('rsc:update', () => {
      void router.refreshRscPayload(true);
    });
  }
}

main();
