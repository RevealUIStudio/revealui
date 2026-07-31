import { encodeBase64Chunked, readStreamToUint8Array } from './base64';
import {
  negotiateRepresentation,
  RSC_CONTENT_TYPE,
  routingPathname,
  type Representation,
} from './negotiate';
import type { Router } from './router';
import type { RouteMatch } from './types';

/**
 * Context passed to the consumer when creating an RSC flight stream.
 * Route match is already resolved against the (endpoint-stripped) pathname.
 */
export interface RscRenderContext {
  pathname: string;
  match: RouteMatch | null;
  representation: Representation;
}

export interface RenderRequestOptions {
  /** Router instance (must be in `'rsc'` mode for negotiation). */
  router: Router;
  /**
   * Produce the RSC flight stream for this request.
   * Consumer typically wires `react-server-dom-webpack` / `@vitejs/plugin-rsc`
   * here so the router stays free of a hard bundler dep (ADR D11).
   */
  createRscStream: (request: Request, ctx: RscRenderContext) => Promise<ReadableStream<Uint8Array>>;
  /**
   * Optional HTML SSR from an RSC stream (plugin-rsc SSR path).
   * When omitted, a minimal document shell is used with `__RSC_PAYLOAD__` inlined.
   */
  renderHtml?: (args: {
    rscStream: ReadableStream<Uint8Array>;
    bootstrapScriptContent: string;
    formState?: unknown;
  }) => Promise<ReadableStream<Uint8Array> | string>;
  /**
   * Bootstrap / client entry script content (ADR D11).
   * Injected after the RSC payload script when using the default HTML shell.
   */
  loadBootstrapScriptContent?: () => Promise<string>;
  formState?: unknown;
  title?: string;
  /** Extra headers on the response (e.g. Cache-Control). */
  headers?: HeadersInit;
}

function defaultHtmlShell(opts: {
  title: string;
  rscPayloadBase64: string;
  bootstrap: string;
  bodyHtml?: string;
}): string {
  const body = opts.bodyHtml ?? '<div id="root"></div>';
  const payloadScript = `self.__RSC_PAYLOAD__=${JSON.stringify(opts.rscPayloadBase64)};`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${escapeHtml(opts.title)}</title>
</head>
<body>
${body}
<script>${payloadScript}</script>
<script type="module">${opts.bootstrap}</script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * Build the inline `self.__RSC_PAYLOAD__=...` assignment from a flight stream
 * half (after tee). Chunked base64 (ADR D15).
 */
export async function inlineRscPayloadScript(
  rscStream: ReadableStream<Uint8Array>,
): Promise<string> {
  const bytes = await readStreamToUint8Array(rscStream);
  const b64 = encodeBase64Chunked(bytes);
  return `self.__RSC_PAYLOAD__=${JSON.stringify(b64)};`;
}

/**
 * RSC-mode request handler (T3 negotiation + T4 render pipeline).
 *
 * - `Accept: text/x-component` (or endpoint path) → flight `text/x-component`
 * - otherwise → HTML with teed payload inlined as `__RSC_PAYLOAD__` + bootstrap
 *
 * Requires `router.mode === 'rsc'`. Client-mode callers should use `createSSRHandler`.
 */
export async function renderRequest(
  request: Request,
  options: RenderRequestOptions,
): Promise<Response> {
  const { router } = options;
  if (router.mode !== 'rsc') {
    throw new Error(
      'renderRequest requires Router in rsc mode: new Router({ rsc: {} }). Client mode: use createSSRHandler.',
    );
  }

  const rscOpts = router.getOptions().rsc;
  const representation = negotiateRepresentation(request, rscOpts);
  const pathname = routingPathname(request, rscOpts);
  const match = await router.resolve(pathname);

  const ctx: RscRenderContext = { pathname, match, representation };
  const rscStream = await options.createRscStream(request, ctx);

  const extra = new Headers(options.headers);
  // Content negotiation requires Vary so caches do not mix HTML and flight.
  if (!extra.has('Vary')) {
    extra.set('Vary', 'accept');
  }

  if (representation === 'rsc') {
    extra.set('Content-Type', `${RSC_CONTENT_TYPE};charset=utf-8`);
    return new Response(rscStream, {
      status: match ? 200 : 404,
      headers: extra,
    });
  }

  // HTML path: tee flight stream — one half inlined as base64, one half for optional SSR.
  const [forPayload, forSsr] = rscStream.tee();
  const bootstrap = options.loadBootstrapScriptContent
    ? await options.loadBootstrapScriptContent()
    : '';

  if (options.renderHtml) {
    const payloadScript = await inlineRscPayloadScript(forPayload);
    const htmlResult = await options.renderHtml({
      rscStream: forSsr,
      bootstrapScriptContent: payloadScript + bootstrap,
      formState: options.formState,
    });
    extra.set('Content-Type', 'text/html; charset=utf-8');
    if (typeof htmlResult === 'string') {
      return new Response(htmlResult, { status: match ? 200 : 404, headers: extra });
    }
    return new Response(htmlResult, { status: match ? 200 : 404, headers: extra });
  }

  // Minimal shell when consumer does not provide SSR renderHtml.
  const bytes = await readStreamToUint8Array(forPayload);
  // Drain the other tee half so the producer is not backpressured.
  await readStreamToUint8Array(forSsr);
  const b64 = encodeBase64Chunked(bytes);
  const title =
    options.title ??
    (typeof match?.route.meta?.title === 'string' ? match.route.meta.title : 'RevealUI');
  const html = defaultHtmlShell({
    title,
    rscPayloadBase64: b64,
    bootstrap,
  });
  extra.set('Content-Type', 'text/html; charset=utf-8');
  return new Response(html, { status: match ? 200 : 404, headers: extra });
}

/**
 * Convenience: HTML template fragment for a matched route component name (tests / shells).
 */
export function routeTitle(match: RouteMatch | null, fallback = 'RevealUI'): string {
  const t = match?.route.meta?.title;
  return typeof t === 'string' && t.length > 0 ? t : fallback;
}
