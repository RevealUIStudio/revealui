import {
  getServerActionId,
  isFormActionRequest,
  RSC_REDIRECT_HEADER,
  runActionMiddleware,
} from './actions';
import { encodeBase64Chunked, readStreamToUint8Array } from './base64';
import {
  isRouterNotFound,
  isRouterRedirect,
  type RouterNotFound,
  RouterRedirect,
} from './navigation';
import {
  negotiateRepresentation,
  type Representation,
  RSC_CONTENT_TYPE,
  routingPathname,
} from './negotiate';
import { runWithRequestAsync } from './request-context';
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
  /** Set after a successful JS server action (T7 / 2.2.4). */
  returnValue?: { ok: boolean; data: unknown };
  /** Opaque action id when this request is a JS mutation. */
  actionId?: string;
  /**
   * Progressive form POST state (2.2.4 / D2 form path).
   * Prefer this over options.formState when both exist (request-derived).
   */
  formState?: unknown;
  /** True when this request ran a progressive form action (no x-rsc-action). */
  formAction?: boolean;
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
  /**
   * Load a server action by opaque id (T7). Required when the request carries
   * `x-rsc-action`. Consumer wires RSDW `loadServerAction` / plugin-rsc.
   */
  loadServerAction?: (id: string) => Promise<(...args: unknown[]) => unknown | Promise<unknown>>;
  /**
   * Decode action arguments from the request body (T7).
   * Defaults to empty args when omitted.
   */
  decodeActionArgs?: (request: Request) => Promise<unknown[]>;
  /**
   * Progressive enhancement form path (2.2.4 / ADR D2): decode `$ACTION_ID`
   * from FormData into a zero-arg invoker (plugin-rsc `decodeAction`).
   */
  decodeFormAction?: (formData: FormData) => Promise<() => unknown | Promise<unknown>>;
  /**
   * Map form action result → form state for HTML re-render (plugin-rsc
   * `decodeFormState`). Optional; when omitted, result is used as formState.
   */
  decodeFormState?: (result: unknown, formData: FormData) => Promise<unknown>;
  /**
   * Seed form state when the consumer already ran the form (legacy). Prefer
   * `decodeFormAction` so the router owns middleware + redirect handling.
   */
  formState?: unknown;
  title?: string;
  /** Extra headers on the response (e.g. Cache-Control). */
  headers?: HeadersInit;
  /**
   * Optional observer for loader / action / form / render failures (2.3.3).
   * Wire to `@revealui/core/observability/capture`. Never pass request bodies.
   */
  onError?: (
    error: unknown,
    meta: {
      phase: 'action' | 'form' | 'loader';
      pathname: string;
      actionId?: string;
    },
  ) => void;
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

function redirectResponse(redirect: RouterRedirect, representation: Representation): Response {
  if (representation === 'html') {
    const status = redirect.permanent ? 308 : 307;
    return new Response(null, {
      status,
      headers: { Location: redirect.path },
    });
  }
  // RSC navigation: JSON body with redirect signal (ADR D6).
  return new Response(JSON.stringify({ redirect: redirect.path, permanent: redirect.permanent }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      [RSC_REDIRECT_HEADER]: redirect.path,
    },
  });
}

async function runActionMiddlewareGate(
  router: Router,
  pathname: string,
  match: RouteMatch | null,
  representation: Representation,
  actionMeta: { actionId?: string | null; formAction?: boolean },
): Promise<Response | null> {
  const mwResult = await runActionMiddleware(router.getActionMiddleware(), {
    pathname,
    params: match?.params ?? {},
    meta: match?.route.meta,
    actionId: actionMeta.actionId,
    formAction: actionMeta.formAction,
  });
  if (mwResult === false) {
    return new Response('Forbidden', { status: 403 });
  }
  if (typeof mwResult === 'string') {
    return redirectResponse(new RouterRedirect(mwResult), representation);
  }
  return null;
}

function notFoundResponse(
  router: Router,
  representation: Representation,
  _error: RouterNotFound,
): Response {
  const NotFound = router.getOptions().notFound;
  if (representation === 'html' && NotFound) {
    // Minimal shell naming the notFound component (full RSC tree is consumer-owned).
    const html = defaultHtmlShell({
      title: 'Not Found',
      rscPayloadBase64: '',
      bootstrap: '',
      bodyHtml: '<div id="root" data-router-not-found="1"></div>',
    });
    return new Response(html, {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
  if (representation === 'html') {
    return new Response('<!DOCTYPE html><html><body><h1>404 - Not Found</h1></body></html>', {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
  return new Response(JSON.stringify({ notFound: true }), {
    status: 404,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
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

async function finishRender(
  request: Request,
  options: RenderRequestOptions,
  ctx: RscRenderContext,
): Promise<Response> {
  const rscStream = await options.createRscStream(request, ctx);

  const extra = new Headers(options.headers);
  if (!extra.has('Vary')) {
    extra.set('Vary', 'accept');
  }

  if (ctx.representation === 'rsc') {
    extra.set('Content-Type', `${RSC_CONTENT_TYPE};charset=utf-8`);
    return new Response(rscStream, {
      status: ctx.match ? 200 : 404,
      headers: extra,
    });
  }

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
    const status = ctx.match ? 200 : 404;
    if (typeof htmlResult === 'string') {
      return new Response(htmlResult, { status, headers: extra });
    }
    return new Response(htmlResult, { status, headers: extra });
  }

  const bytes = await readStreamToUint8Array(forPayload);
  await readStreamToUint8Array(forSsr);
  const b64 = encodeBase64Chunked(bytes);
  const title =
    options.title ??
    (typeof ctx.match?.route.meta?.title === 'string' ? ctx.match.route.meta.title : 'RevealUI');
  const html = defaultHtmlShell({
    title,
    rscPayloadBase64: b64,
    bootstrap,
  });
  extra.set('Content-Type', 'text/html; charset=utf-8');
  return new Response(html, { status: ctx.match ? 200 : 404, headers: extra });
}

/**
 * RSC-mode request handler (T3–T7 + 2.2.4 form path).
 *
 * - Content negotiation + endpoint strip (T3)
 * - Flight / HTML with teed `__RSC_PAYLOAD__` (T4)
 * - `redirect` / `notFound` sentinels (T5)
 * - Request ALS for `getRequest()` (T6)
 * - `x-rsc-action` + actionMiddleware (T7)
 * - Progressive form POST without `x-rsc-action` (2.2.4 / D2)
 */
export async function renderRequest(
  request: Request,
  options: RenderRequestOptions,
): Promise<Response> {
  return runWithRequestAsync(request, async () => {
    const { router } = options;
    if (router.mode !== 'rsc') {
      throw new Error(
        'renderRequest requires Router in rsc mode: new Router({ rsc: {} }). Client mode: use createSSRHandler from @revealui/router/server-ssr.',
      );
    }

    const rscOpts = router.getOptions().rsc;
    const representation = negotiateRepresentation(request, rscOpts);
    const pathname = routingPathname(request, rscOpts);

    try {
      const actionId = getServerActionId(request);
      let returnValue: RscRenderContext['returnValue'];
      let match: RouteMatch | null = null;
      let formState: unknown = options.formState;
      let formAction = false;

      if (actionId) {
        // JS server-action path (ADR D2): x-rsc-action + Accept flight.
        match = router.match(pathname);
        const blocked = await runActionMiddlewareGate(router, pathname, match, representation, {
          actionId,
        });
        if (blocked) return blocked;

        if (!options.loadServerAction) {
          throw new Error(
            'renderRequest: loadServerAction is required when x-rsc-action is present',
          );
        }
        const action = await options.loadServerAction(actionId);
        const args = options.decodeActionArgs ? await options.decodeActionArgs(request) : [];
        try {
          const data = await action(...args);
          returnValue = { ok: true, data };
        } catch (error) {
          if (isRouterRedirect(error)) return redirectResponse(error, representation);
          if (isRouterNotFound(error)) return notFoundResponse(router, representation, error);
          options.onError?.(error, { phase: 'action', pathname, actionId });
          returnValue = { ok: false, data: error instanceof Error ? error.message : String(error) };
        }
        match = await router.resolve(pathname);
      } else if (isFormActionRequest(request) && options.decodeFormAction) {
        // Progressive form path (ADR D2 / 2.2.4): no x-rsc-action, FormData body.
        formAction = true;
        match = router.match(pathname);
        const blocked = await runActionMiddlewareGate(router, pathname, match, representation, {
          formAction: true,
        });
        if (blocked) return blocked;

        const formData = await request.formData();
        const decodedAction = await options.decodeFormAction(formData);
        try {
          const result = await decodedAction();
          formState = options.decodeFormState
            ? await options.decodeFormState(result, formData)
            : result;
        } catch (error) {
          if (isRouterRedirect(error)) return redirectResponse(error, representation);
          if (isRouterNotFound(error)) return notFoundResponse(router, representation, error);
          options.onError?.(error, { phase: 'form', pathname });
          return new Response('Internal Server Error: server action failed', { status: 500 });
        }
        match = await router.resolve(pathname);
      } else {
        match = await router.resolve(pathname);
      }

      const ctx: RscRenderContext = {
        pathname,
        match,
        representation,
        returnValue,
        actionId: actionId ?? undefined,
        formState,
        formAction: formAction || undefined,
      };
      // Prefer request-derived formState for HTML shell when present.
      const finishOptions = formState !== undefined ? { ...options, formState } : options;
      return await finishRender(request, finishOptions, ctx);
    } catch (error) {
      if (isRouterRedirect(error)) {
        return redirectResponse(error, representation);
      }
      if (isRouterNotFound(error)) {
        return notFoundResponse(router, representation, error);
      }
      // Misconfiguration (missing callbacks) should fail loud for developers.
      if (
        error instanceof Error &&
        (error.message.includes('loadServerAction is required') ||
          error.message.includes('renderRequest requires Router'))
      ) {
        throw error;
      }
      // Phase 2.3.2: loader/render failures → controlled 500 (no stack leak in prod).
      options.onError?.(error, { phase: 'loader', pathname });
      return internalErrorResponse(error, representation);
    }
  });
}

/**
 * Safe 500 for unexpected loader/render failures (2.3.2).
 * HTML gets a minimal recovery shell; RSC gets JSON so soft-nav can surface it.
 */
function internalErrorResponse(error: unknown, representation: Representation): Response {
  const message = error instanceof Error && error.message ? error.message : 'Internal Server Error';
  const publicMessage =
    process.env.NODE_ENV === 'production' ? 'Something went wrong. Please try again.' : message;

  if (representation === 'rsc') {
    return new Response(JSON.stringify({ error: true, message: publicMessage }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Router-Error': '1',
      },
    });
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Error</title>
</head>
<body>
<div id="root" data-router-error="1" style="padding:2rem;text-align:center;font-family:system-ui,sans-serif">
  <h1>Something went wrong</h1>
  <p>${escapeHtml(publicMessage)}</p>
  <p><a href="/">Go Home</a></p>
</div>
</body>
</html>`;
  return new Response(html, {
    status: 500,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

/**
 * Convenience: HTML template fragment for a matched route component name (tests / shells).
 */
export function routeTitle(match: RouteMatch | null, fallback = 'RevealUI'): string {
  const t = match?.route.meta?.title;
  return typeof t === 'string' && t.length > 0 ? t : fallback;
}
