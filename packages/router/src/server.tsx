/**
 * RSC-safe server subpath (`@revealui/router/server`).
 *
 * Must not import `react-dom/server` — that module is unavailable under the
 * plugin-rsc "react-server" condition. Client-mode SPA SSR lives at
 * `@revealui/router/server-ssr` (`createSSRHandler`, `hydrate`, `createDevServer`).
 */

export {
  getRouterRedirect,
  getServerActionId,
  isFormActionRequest,
  isServerActionRequest,
  RSC_ACTION_HEADER,
  RSC_REDIRECT_HEADER,
  runActionMiddleware,
} from './actions';
export {
  encodeBase64Chunked,
  readStreamToUint8Array,
} from './base64';
export {
  isRouterNotFound,
  isRouterRedirect,
  notFound,
  RouterNotFound,
  RouterRedirect,
  redirect,
} from './navigation';
export {
  negotiateRepresentation,
  type Representation,
  RSC_ACCEPT,
  RSC_CONTENT_TYPE,
  resolveRscClientUrl,
  resolveRscEndpointPath,
  routingPathname,
  wantsRscPayload,
} from './negotiate';
export {
  getRequest,
  getRequestOrNull,
  runWithRequest,
  runWithRequestAsync,
} from './request-context';
export {
  inlineRscPayloadScript,
  type RenderRequestOptions,
  type RscRenderContext,
  renderRequest,
  routeTitle,
} from './server-rsc';
