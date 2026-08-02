/**
 * RSC entry — renderRequest owns JS actions (T7) and progressive forms (2.2.4).
 * Session login/logout are progressive form endpoints outside the flight path (2.3.1).
 * Observability: `@revealui/core/observability` Node init (2.3.3).
 */

import { logger } from '@revealui/core/observability/logger';
import { renderRequest } from '@revealui/router/server';
import {
  createTemporaryReferenceSet,
  decodeAction,
  decodeFormState,
  decodeReply,
  loadServerAction,
  renderToReadableStream,
} from '@vitejs/plugin-rsc/rsc';
import type { ReactFormState } from 'react-dom/client';
import { registerServerErrorRoutes } from './app-router.server.ts';
import { createAppRouter } from './app-router.ts';
import { sessionClearCookieHeader, sessionSetCookieHeader, signSession } from './auth/session.ts';
import {
  bindRequestIdFromRequest,
  initRscPocNodeObservability,
  reportRenderError,
} from './observability/node.ts';
import { AppLayout } from './pages/layout.tsx';
import { NotFoundPage } from './pages/not-found.tsx';

initRscPocNodeObservability();

export interface RscPayload {
  root: React.ReactNode;
  returnValue?: { ok: boolean; data: unknown };
  formState?: ReactFormState;
}

const router = createAppRouter();
registerServerErrorRoutes(router);

function renderMatchedTree(match: ReturnType<typeof router.match>): React.ReactNode {
  if (!match) {
    return (
      <AppLayout>
        <NotFoundPage />
      </AppLayout>
    );
  }

  const { route, params, data } = match;
  const Page = route.component;
  const Layout = route.layout ?? AppLayout;
  const page = <Page params={params} data={data} />;
  return <Layout>{page}</Layout>;
}

export default { fetch: handler };

async function handleSessionApi(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (request.method !== 'POST') return null;

  if (url.pathname === '/api/session/login') {
    const form = await request.formData();
    const subRaw = form.get('sub');
    const sub = typeof subRaw === 'string' && subRaw.length > 0 ? subRaw : 'demo';
    const token = await signSession({ sub, iat: Date.now() });
    logger.info('rsc-poc: session login', { sub });
    return new Response(null, {
      status: 303,
      headers: {
        Location: '/session',
        'Set-Cookie': sessionSetCookieHeader(token),
      },
    });
  }

  if (url.pathname === '/api/session/logout') {
    logger.info('rsc-poc: session logout');
    return new Response(null, {
      status: 303,
      headers: {
        Location: '/session',
        'Set-Cookie': sessionClearCookieHeader(),
      },
    });
  }

  return null;
}

async function handler(request: Request): Promise<Response> {
  bindRequestIdFromRequest(request);

  const sessionApi = await handleSessionApi(request);
  if (sessionApi) return sessionApi;

  let temporaryReferences: unknown | undefined;

  logger.debug('rsc-poc: renderRequest', {
    method: request.method,
    path: new URL(request.url).pathname,
  });

  return renderRequest(request, {
    router,
    title: 'RSC POC — dual-mode router',
    onError: reportRenderError,
    loadServerAction: async (id) => {
      const action = await loadServerAction(id);
      return action as (...args: unknown[]) => unknown | Promise<unknown>;
    },
    decodeActionArgs: async (req) => {
      const contentType = req.headers.get('content-type');
      const body = contentType?.startsWith('multipart/form-data')
        ? await req.formData()
        : await req.text();
      temporaryReferences = createTemporaryReferenceSet();
      const args = await decodeReply(body, { temporaryReferences });
      return args as unknown[];
    },
    decodeFormAction: async (formData) => {
      const decoded = await decodeAction(formData);
      return decoded as () => unknown | Promise<unknown>;
    },
    decodeFormState: async (result, formData) => {
      return decodeFormState(result, formData);
    },
    createRscStream: async (_req, ctx) => {
      router.seedCurrentMatch(ctx.match);
      const rscPayload: RscPayload = {
        root: renderMatchedTree(ctx.match),
        formState: ctx.formState as ReactFormState | undefined,
        returnValue: ctx.returnValue,
      };
      return renderToReadableStream<RscPayload>(rscPayload, { temporaryReferences });
    },
    loadBootstrapScriptContent: () => import.meta.viteRsc.loadBootstrapScriptContent('index'),
    renderHtml: async ({ rscStream, bootstrapScriptContent, formState: fs }) => {
      const ssrEntry = await import.meta.viteRsc.loadModule<typeof import('./entry.ssr.tsx')>(
        'ssr',
        'index',
      );
      return ssrEntry.renderHTML(rscStream, {
        formState: fs as ReactFormState | undefined,
        bootstrapScriptContent,
      });
    },
  });
}

if (import.meta.hot) {
  import.meta.hot.accept();
}
