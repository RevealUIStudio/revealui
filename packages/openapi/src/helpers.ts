import type { Hono } from 'hono';
import { mergePath } from 'hono/utils/url';

import type { HonoToOpenAPIHono } from './types.js';

/**
 * Prepends a base path to all paths in an OpenAPI document.
 * Converts Hono `:param` syntax to OpenAPI `{param}` in the base path.
 */
export function addBasePathToDocument(
  document: Record<string, unknown>,
  basePath: string,
): Record<string, unknown> {
  const paths = document.paths as Record<string, unknown>;
  const updatedPaths: Record<string, unknown> = {};

  for (const path of Object.keys(paths)) {
    const newPath = mergePath(basePath.replaceAll(/:([^/]+)/g, '{$1}'), path);
    updatedPaths[newPath] = paths[path];
  }

  return {
    ...document,
    paths: updatedPaths,
  };
}

/**
 * Identity function that casts a Hono instance to OpenAPIHono type.
 * Use after chaining methods like `.use()` which lose the OpenAPIHono type.
 *
 * @example
 * ```ts
 * const app = $(new OpenAPIHono().use(middleware))
 * app.openapi(route, handler) // type-safe
 * ```
 */
// biome-ignore lint/suspicious/noExplicitAny: Hono generic constraints require any for flexible type matching
export const $ = <T extends Hono<any, any, any>>(app: T): HonoToOpenAPIHono<T> => {
  return app as HonoToOpenAPIHono<T>;
};
