'use client';

import {
  createFromFetch,
  createFromReadableStream,
  createTemporaryReferenceSet,
  encodeReply,
  setServerCallback,
} from '@vitejs/plugin-rsc/browser';
import React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import type { RscPayload } from './entry.rsc.tsx';

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

  function BrowserRoot(): React.ReactNode {
    const [payload, setPayload_] = React.useState(initialPayload);

    React.useEffect(() => {
      setPayload = (v) => React.startTransition(() => setPayload_(v));
    }, []);

    React.useEffect(() => {
      return listenNavigation(() => {
        fetchRscPayload(window.location.href).then((p) => setPayload?.(p));
      });
    }, []);

    return payload.root;
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

function listenNavigation(onNavigation: () => void): () => void {
  window.addEventListener('popstate', onNavigation);

  const oldPushState = window.history.pushState.bind(window.history);
  window.history.pushState = (...args: Parameters<typeof window.history.pushState>) => {
    const res = oldPushState(...args);
    onNavigation();
    return res;
  };

  const oldReplaceState = window.history.replaceState.bind(window.history);
  window.history.replaceState = (...args: Parameters<typeof window.history.replaceState>) => {
    const res = oldReplaceState(...args);
    onNavigation();
    return res;
  };

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
      history.pushState(null, '', link.href);
    }
  }

  document.addEventListener('click', onClick);

  return () => {
    document.removeEventListener('click', onClick);
    window.removeEventListener('popstate', onNavigation);
    window.history.pushState = oldPushState;
    window.history.replaceState = oldReplaceState;
  };
}

main();
