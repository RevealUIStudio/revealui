import type { RouteConfig, RoutingPath } from './types.js';

/**
 * Creates a route definition with a non-enumerable `getRoutingPath()` method
 * that converts OpenAPI `{param}` syntax to Hono `:param` syntax.
 */
export const createRoute = <P extends string, R extends Omit<RouteConfig, 'path'> & { path: P }>(
  routeConfig: R,
): R & { getRoutingPath(): RoutingPath<R['path']> } => {
  const route = {
    ...routeConfig,
    getRoutingPath() {
      return routeConfig.path.replaceAll(/\/{(.+?)}/g, '/:$1') as RoutingPath<R['path']>;
    },
  };
  return Object.defineProperty(route, 'getRoutingPath', {
    enumerable: false,
  });
};
