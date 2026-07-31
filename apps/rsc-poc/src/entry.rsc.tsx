import {
  createTemporaryReferenceSet,
  decodeAction,
  decodeFormState,
  decodeReply,
  loadServerAction,
  renderToReadableStream,
} from '@vitejs/plugin-rsc/rsc';
import type { ReactFormState } from 'react-dom/client';
import { ActionsPage } from './pages/actions.tsx';
import { CounterPage } from './pages/counter.tsx';
import { HomePage } from './pages/home.tsx';

export interface RscPayload {
  root: React.ReactNode;
  returnValue?: { ok: boolean; data: unknown };
  formState?: ReactFormState;
}

function resolvePageComponent(pathname: string): React.ReactNode {
  if (pathname === '/counter') {
    return <CounterPage />;
  }
  if (pathname === '/actions') {
    return <ActionsPage />;
  }
  return <HomePage />;
}

function NavBar(): React.ReactNode {
  return (
    <nav
      style={{
        padding: '12px 16px',
        borderBottom: '1px solid #e5e7eb',
        marginBottom: '24px',
        display: 'flex',
        gap: '16px',
      }}
    >
      <a href="/">Home</a>
      <a href="/counter">Counter</a>
      <a href="/actions">Actions</a>
    </nav>
  );
}

function Layout({ children }: { children: React.ReactNode }): React.ReactNode {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>RSC POC — Phase 2.1 spike</title>
      </head>
      <body>
        <NavBar />
        <main style={{ padding: '0 16px' }}>{children}</main>
      </body>
    </html>
  );
}

export default { fetch: handler };

async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);

  let returnValue: RscPayload['returnValue'] | undefined;
  let formState: ReactFormState | undefined;
  let temporaryReferences: unknown | undefined;
  let actionStatus: number | undefined;

  const actionId = request.headers.get('x-rsc-action');
  const isFormAction = request.method === 'POST' && !actionId;

  if (actionId) {
    const contentType = request.headers.get('content-type');
    const body = contentType?.startsWith('multipart/form-data')
      ? await request.formData()
      : await request.text();
    temporaryReferences = createTemporaryReferenceSet();
    const args = await decodeReply(body, { temporaryReferences });
    const action = await loadServerAction(actionId);
    try {
      const data = await (action as (...a: unknown[]) => Promise<unknown>)(...(args as unknown[]));
      returnValue = { ok: true, data };
    } catch (e) {
      returnValue = { ok: false, data: e };
      actionStatus = 500;
    }
  } else if (isFormAction) {
    const formData = await request.formData();
    const decodedAction = await decodeAction(formData);
    try {
      const result = await decodedAction();
      formState = await decodeFormState(result, formData);
    } catch {
      return new Response('Internal Server Error: server action failed', { status: 500 });
    }
  }

  const page = resolvePageComponent(url.pathname);
  const rscPayload: RscPayload = {
    root: <Layout>{page}</Layout>,
    formState,
    returnValue,
  };
  const rscStream = renderToReadableStream<RscPayload>(rscPayload, { temporaryReferences });

  const isRscRequest =
    url.pathname.endsWith('.rsc') || request.headers.get('accept') === 'text/x-component';
  if (isRscRequest) {
    return new Response(rscStream, {
      status: actionStatus,
      headers: { 'content-type': 'text/x-component;charset=utf-8' },
    });
  }

  const ssrEntry = await import.meta.viteRsc.loadModule<typeof import('./entry.ssr.tsx')>(
    'ssr',
    'index',
  );
  const htmlStream = await ssrEntry.renderHTML(rscStream, { formState });

  return new Response(htmlStream, {
    headers: { 'content-type': 'text/html' },
  });
}

if (import.meta.hot) {
  import.meta.hot.accept();
}
