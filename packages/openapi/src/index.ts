// Class & factory

export { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
// Zod re-export (convenience — consumers can import from either place)
export { z } from 'zod';
export { createRoute } from './create-route.js';

// Helpers
export { $ } from './helpers.js';
export { OpenAPIHono } from './openapi-hono.js';
// Types — matches upstream public API surface
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
// Validation middleware
export { zValidator } from './zod-validator.js';
