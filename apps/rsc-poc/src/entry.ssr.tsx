import { createFromReadableStream } from '@vitejs/plugin-rsc/ssr';
import React from 'react';
import type { ReactFormState } from 'react-dom/client';
import { renderToReadableStream } from 'react-dom/server.edge';
import type { RscPayload } from './entry.rsc.tsx';

export async function renderHTML(
  rscStream: ReadableStream<Uint8Array>,
  options: { formState?: ReactFormState },
): Promise<ReadableStream<Uint8Array>> {
  const [rscStream1, rscStream2] = rscStream.tee();

  let payload: Promise<RscPayload> | undefined;
  function SsrRoot(): React.ReactNode {
    payload ??= createFromReadableStream<RscPayload>(rscStream1);
    return React.use(payload).root;
  }

  const bootstrapScriptContent = await import.meta.viteRsc.loadBootstrapScriptContent('index');

  const chunks: Uint8Array[] = [];
  const reader = rscStream2.getReader();
  const _encoder = new TextEncoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const rscBytes = chunks.reduce((acc, c) => {
    const merged = new Uint8Array(acc.length + c.length);
    merged.set(acc);
    merged.set(c, acc.length);
    return merged;
  }, new Uint8Array(0));
  const rscBase64 = btoa(String.fromCharCode(...rscBytes));

  const rscInlineScript = `self.__RSC_PAYLOAD__="${rscBase64}";`;

  const htmlStream = await renderToReadableStream(<SsrRoot />, {
    bootstrapScriptContent: rscInlineScript + bootstrapScriptContent,
    formState: options.formState,
  });

  return htmlStream;
}
