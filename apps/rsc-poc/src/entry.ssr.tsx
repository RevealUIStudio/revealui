/**
 * SSR entry — consumes teed RSC flight half + bootstrap that already inlines
 * `__RSC_PAYLOAD__` (via `@revealui/router/server` `inlineRscPayloadScript` in
 * `renderRequest`). No second base64 pass (D15 / chunked encode stays in router).
 */
import { createFromReadableStream } from '@vitejs/plugin-rsc/ssr';
import React from 'react';
import type { ReactFormState } from 'react-dom/client';
import { renderToReadableStream } from 'react-dom/server.edge';
import type { RscPayload } from './entry.rsc.tsx';

export async function renderHTML(
  rscStream: ReadableStream<Uint8Array>,
  options: {
    formState?: ReactFormState;
    /** When set (from `renderRequest`), already includes payload script + client entry. */
    bootstrapScriptContent?: string;
  },
): Promise<ReadableStream<Uint8Array>> {
  let payload: Promise<RscPayload> | undefined;
  function SsrRoot(): React.ReactNode {
    payload ??= createFromReadableStream<RscPayload>(rscStream);
    return React.use(payload).root;
  }

  const bootstrapScriptContent =
    options.bootstrapScriptContent ??
    (await import.meta.viteRsc.loadBootstrapScriptContent('index'));

  return renderToReadableStream(<SsrRoot />, {
    bootstrapScriptContent,
    formState: options.formState,
  });
}
