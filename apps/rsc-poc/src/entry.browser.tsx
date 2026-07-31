/**
 * Browser entry — hydrate from `__RSC_PAYLOAD__`, re-fetch flight on navigation.
 *
 * D3: no `history.pushState` monkey-patch. Interception is click/popstate only
 * (same ownership model as `@revealui/router` `initClient`). Full router-owned
 * RSC payload state lands in 2.2.3; this entry is the consumer-side pattern.
 */
'use client';

import { RouterProvider } from '@revealui/router';
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

const router = createAppRouter();

async function main(): Promise<void> {
  let setPayload: ((v: RscPayload) => void) | undefined;

  async function fetchRscPayload(url: string): Promise<RscPayload> {
    return createFromFetch<RscPayload>(fetch(url, { headers: { accept: 'text/x-component' } }));
  }

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
    initialPayload = await fetchRscPayload(window.location.href);
  }

  // Seed match so client hooks see the SSR route without re-running loaders.
  const initialPath = window.location.pathname;
  router.seedCurrentMatch(router.match(initialPath));

  function BrowserRoot(): React.ReactNode {
    const [payload, setPayload_] = React.useState(initialPayload);

    React.useEffect(() => {
      setPayload = (v) => React.startTransition(() => setPayload_(v));
    }, []);

    React.useEffect(() => {
      return listenNavigation(() => {
        const path = window.location.pathname;
        router.seedCurrentMatch(router.match(path));
        fetchRscPayload(window.location.href).then((p) => setPayload?.(p));
      });
    }, []);

    return <RouterProvider router={router}>{payload.root}</RouterProvider>;
  }

  setServerCallback(async (id: string, args: unknown[]) => {
    const temporaryReferences = createTemporaryReferenceSet();
    const body = await encodeReply(args, { temporaryReferences });
    const headers: Record<string, string> = {
      'x-rsc-action': id,
      accept: 'text/x-component',
    };
    if (typeof body === 'string') {
      headers['content-type'] = 'text/plain;charset=UTF-8';
    }
    const payload = await createFromFetch<RscPayload>(
      fetch(window.location.href, {
        method: 'POST',
        headers,
        body: body as BodyInit,
      }),
      { temporaryReferences },
    );
    setPayload?.(payload);
    const rv = payload.returnValue;
    if (!rv) return undefined;
    if (!rv.ok) throw rv.data;
    return rv.data;
  });

  const browserRoot = (
    <React.StrictMode>
      <BrowserRoot />
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
      fetchRscPayload(window.location.href).then((p) => setPayload?.(p));
    });
  }
}

/**
 * Same-origin soft navigation: click + popstate only (no History API patch — D3).
 */
function listenNavigation(onNavigation: () => void): () => void {
  window.addEventListener('popstate', onNavigation);

  function onClick(e: MouseEvent): void {
    const link = (e.target as Element).closest('a');
    if (
      link instanceof HTMLAnchorElement &&
      link.href &&
      (!link.target || link.target === '_self') &&
      link.origin === location.origin &&
      !link.hasAttribute('download') &&
      e.button === 0 &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.altKey &&
      !e.shiftKey &&
      !e.defaultPrevented
    ) {
      e.preventDefault();
      const url = new URL(link.href);
      const next = url.pathname + url.search + url.hash;
      const current = window.location.pathname + window.location.search + window.location.hash;
      if (next === current) return;
      window.history.pushState(null, '', next);
      onNavigation();
    }
  }

  document.addEventListener('click', onClick);

  return () => {
    document.removeEventListener('click', onClick);
    window.removeEventListener('popstate', onNavigation);
  };
}

main();
