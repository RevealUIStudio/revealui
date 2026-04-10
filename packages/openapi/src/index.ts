/**
 * @revealui/openapi — OpenAPI integration for Hono with Zod validation.
 *
 * Generates OpenAPI 3.x specs from typed route definitions and provides
 * request validation middleware. Powers the Swagger UI at `/docs`.
 *
 * @packageDocumentation
 */

/** Zod re-export — consumers can import from either `zod` or this package. */
export { z } from 'zod';
/** Define a typed route with request/response schemas for OpenAPI generation. */
export { createRoute } from './create-route.js';
/** Shorthand helper for OpenAPI schema references (`$ref`). */
export { $ } from './helpers.js';
/** Add `.openapi()` method to Zod types for OpenAPI schema generation. */
export { extendZodWithOpenApi } from './native/zod-extension.js';

/** Extended Hono app with OpenAPI route registration and spec generation. */
export { OpenAPIHono } from './openapi-hono.js';

export type {
  DeepSimplify,
  HonoToOpenAPIHono,
  Hook,
  MiddlewareToHandlerType,
  OfHandlerType,
  OpenAPIGeneratorConfigure,
  OpenAPIGeneratorOptions,
  OpenAPIHonoOptions,
  OpenAPIObjectConfigure,
  RouteConfig,
  RouteConfigToEnv,
  RouteConfigToTypedResponse,
  RouteHandler,
  RouteHook,
} from './types.js';

/** Validate request body/query/params against a Zod schema as Hono middleware. */
export { zValidator } from './zod-validator.js';
