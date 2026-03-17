import {
  extendZodWithOpenApi,
  getOpenApiMetadata,
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  OpenApiGeneratorV31,
} from '@asteasolutions/zod-to-openapi';
import type { Env, Schema } from 'hono';
import { Hono } from 'hono';
import { mergePath } from 'hono/utils/url';
import type { OpenAPIObject } from 'openapi3-ts/oas30';
import type { OpenAPIObject as OpenAPIObject31 } from 'openapi3-ts/oas31';
import { z } from 'zod';

import { addBasePathToDocument } from './helpers.js';
import { isFormContentType, isJSONContentType, isZod } from './type-guard.js';
import type {
  HonoInit,
  OpenAPIGeneratorConfigure,
  OpenAPIGeneratorOptions,
  OpenAPIObjectConfig,
  OpenAPIObjectConfigure,
  RouteConfig,
} from './types.js';
import { zValidator } from './zod-validator.js';

// Extend Zod with OpenAPI metadata methods (.openapi())
extendZodWithOpenApi(z);

/**
 * OpenAPI-aware Hono instance.
 * Extends Hono with route registry, validation wiring, and OpenAPI doc generation.
 */
export class OpenAPIHono<
  E extends Env = Env,
  // biome-ignore lint/complexity/noBannedTypes: {} is Hono's internal sentinel for empty Schema — using object breaks type inference
  S extends Schema = {},
  BasePath extends string = '/',
> extends Hono<E, S, BasePath> {
  openAPIRegistry: OpenAPIRegistry;
  defaultHook?: HonoInit<E>['defaultHook'];

  constructor(init?: HonoInit<E>) {
    super(init);
    this.openAPIRegistry = new OpenAPIRegistry();
    this.defaultHook = init?.defaultHook;
  }

  /**
   * Register an OpenAPI route with automatic request validation.
   */
  openapi = (
    {
      middleware: routeMiddleware,
      hide,
      ...route
    }: RouteConfig & { middleware?: unknown | unknown[]; hide?: boolean },
    handler: unknown,
    hook: unknown = this.defaultHook,
  ) => {
    if (!hide) {
      // biome-ignore lint/suspicious/noExplicitAny: registerPath accepts route config with flexible shape
      this.openAPIRegistry.registerPath(route as any);
    }

    const validators: unknown[] = [];

    if (route.request?.query) {
      // biome-ignore lint/suspicious/noExplicitAny: Zod schema type flexibility for validation wiring
      validators.push(zValidator('query', route.request.query as any, hook as any));
    }
    if (route.request?.params) {
      // biome-ignore lint/suspicious/noExplicitAny: Zod schema type flexibility for validation wiring
      validators.push(zValidator('param', route.request.params as any, hook as any));
    }
    if (route.request?.headers) {
      // biome-ignore lint/suspicious/noExplicitAny: Zod schema type flexibility for validation wiring
      validators.push(zValidator('header', route.request.headers as any, hook as any));
    }
    if (route.request?.cookies) {
      // biome-ignore lint/suspicious/noExplicitAny: Zod schema type flexibility for validation wiring
      validators.push(zValidator('cookie', route.request.cookies as any, hook as any));
    }

    const bodyContent = route.request?.body?.content;
    if (bodyContent) {
      for (const mediaType of Object.keys(bodyContent)) {
        if (!bodyContent[mediaType]) continue;
        const schema = bodyContent[mediaType].schema;
        if (!isZod(schema)) continue;

        if (isJSONContentType(mediaType)) {
          // biome-ignore lint/suspicious/noExplicitAny: Zod schema type flexibility for validation wiring
          const jsonValidator = zValidator('json', schema as any, hook as any);
          if (route.request?.body?.required) {
            validators.push(jsonValidator);
          } else {
            // Skip JSON validation when content-type is absent
            // biome-ignore lint/suspicious/noExplicitAny: Hono middleware context requires flexible typing
            const mw = async (c: any, next: any) => {
              const ct = c.req.header('content-type');
              if (ct && isJSONContentType(ct)) {
                // biome-ignore lint/suspicious/noExplicitAny: delegating to typed validator
                return await (jsonValidator as any)(c, next);
              }
              c.req.addValidatedData('json', {});
              await next();
            };
            validators.push(mw);
          }
        }

        if (isFormContentType(mediaType)) {
          // biome-ignore lint/suspicious/noExplicitAny: Zod schema type flexibility for validation wiring
          const formValidator = zValidator('form', schema as any, hook as any);
          if (route.request?.body?.required) {
            validators.push(formValidator);
          } else {
            // biome-ignore lint/suspicious/noExplicitAny: Hono middleware context requires flexible typing
            const mw = async (c: any, next: any) => {
              const ct = c.req.header('content-type');
              if (ct && isFormContentType(ct)) {
                // biome-ignore lint/suspicious/noExplicitAny: delegating to typed validator
                return await (formValidator as any)(c, next);
              }
              c.req.addValidatedData('form', {});
              await next();
            };
            validators.push(mw);
          }
        }
      }
    }

    const middleware = routeMiddleware
      ? Array.isArray(routeMiddleware)
        ? routeMiddleware
        : [routeMiddleware]
      : [];

    // biome-ignore lint/suspicious/noExplicitAny: Hono's .on() requires flexible typing for dynamic route registration
    (this as any).on(
      [route.method],
      [route.path.replaceAll(/\/{(.+?)}/g, '/:$1')],
      ...middleware,
      ...validators,
      handler,
    );

    return this;
  };

  /**
   * Generate an OpenAPI 3.0 document from registered routes.
   */
  getOpenAPIDocument = (
    objectConfig: OpenAPIObjectConfig,
    generatorConfig?: OpenAPIGeneratorOptions,
  ): OpenAPIObject => {
    const document = new OpenApiGeneratorV3(
      this.openAPIRegistry.definitions,
      generatorConfig,
    ).generateDocument(objectConfig);
    // biome-ignore lint/suspicious/noExplicitAny: accessing internal _basePath property
    return (this as any)._basePath
      ? // biome-ignore lint/suspicious/noExplicitAny: accessing internal _basePath property
        addBasePathToDocument(document, (this as any)._basePath)
      : document;
  };

  /**
   * Generate an OpenAPI 3.1 document from registered routes.
   */
  getOpenAPI31Document = (
    objectConfig: OpenAPIObjectConfig,
    generatorConfig?: OpenAPIGeneratorOptions,
  ): OpenAPIObject31 => {
    const document = new OpenApiGeneratorV31(
      this.openAPIRegistry.definitions,
      generatorConfig,
    ).generateDocument(objectConfig);
    // biome-ignore lint/suspicious/noExplicitAny: accessing internal _basePath property
    return (this as any)._basePath
      ? (addBasePathToDocument(
          document as unknown as OpenAPIObject,
          // biome-ignore lint/suspicious/noExplicitAny: accessing internal _basePath property
          (this as any)._basePath,
        ) as unknown as OpenAPIObject31)
      : document;
  };

  /**
   * Serve OpenAPI 3.0 JSON at a given path.
   */
  doc = <P extends string>(
    path: P,
    configureObject: OpenAPIObjectConfigure<E, P>,
    configureGenerator?: OpenAPIGeneratorConfigure<E, P>,
  ) => {
    // biome-ignore lint/suspicious/noExplicitAny: Hono context type flexibility for dynamic route handler
    return this.get(path, (c: any) => {
      const objectConfig =
        typeof configureObject === 'function' ? configureObject(c) : configureObject;
      const generatorConfig =
        typeof configureGenerator === 'function' ? configureGenerator(c) : configureGenerator;
      try {
        const document = this.getOpenAPIDocument(objectConfig, generatorConfig);
        return c.json(document);
      } catch (e) {
        return c.json(e, 500);
      }
    });
  };

  /**
   * Serve OpenAPI 3.1 JSON at a given path.
   */
  doc31 = <P extends string>(
    path: P,
    configureObject: OpenAPIObjectConfigure<E, P>,
    configureGenerator?: OpenAPIGeneratorConfigure<E, P>,
  ) => {
    // biome-ignore lint/suspicious/noExplicitAny: Hono context type flexibility for dynamic route handler
    return this.get(path, (c: any) => {
      const objectConfig =
        typeof configureObject === 'function' ? configureObject(c) : configureObject;
      const generatorConfig =
        typeof configureGenerator === 'function' ? configureGenerator(c) : configureGenerator;
      try {
        const document = this.getOpenAPI31Document(objectConfig, generatorConfig);
        return c.json(document);
      } catch (e) {
        return c.json(e, 500);
      }
    });
  };

  /**
   * Override Hono's route() to merge OpenAPI registries from sub-apps.
   */
  // biome-ignore lint/suspicious/noExplicitAny: Hono's route() accepts any Hono instance shape
  route<SubPath extends string>(path: SubPath, app?: Hono<any, any, any>) {
    // biome-ignore lint/suspicious/noExplicitAny: matching Hono's route() signature — app is optional in JS but TS requires 2 args
    if (!app) return (super.route as (path: string) => this)(path);

    const pathForOpenAPI = path.replaceAll(/:([^/]+)/g, '{$1}');
    super.route(path, app);

    if (!(app instanceof OpenAPIHono)) return this;

    for (const def of app.openAPIRegistry.definitions) {
      switch (def.type) {
        case 'component':
          this.openAPIRegistry.registerComponent(
            // biome-ignore lint/suspicious/noExplicitAny: registry definition type is loosely typed
            (def as any).componentType,
            // biome-ignore lint/suspicious/noExplicitAny: registry definition type is loosely typed
            (def as any).name,
            // biome-ignore lint/suspicious/noExplicitAny: registry definition type is loosely typed
            (def as any).component,
          );
          break;
        case 'route':
          this.openAPIRegistry.registerPath({
            // biome-ignore lint/suspicious/noExplicitAny: registry definition type is loosely typed
            ...(def as any).route,
            path: mergePath(
              pathForOpenAPI,
              // biome-ignore lint/suspicious/noExplicitAny: accessing internal _basePath property
              ((app as any)._basePath || '').replaceAll(/:([^/]+)/g, '{$1}'),
              // biome-ignore lint/suspicious/noExplicitAny: registry definition type is loosely typed
              (def as any).route.path,
            ),
          });
          break;
        case 'webhook':
          this.openAPIRegistry.registerWebhook({
            // biome-ignore lint/suspicious/noExplicitAny: registry definition type is loosely typed
            ...(def as any).webhook,
            path: mergePath(
              pathForOpenAPI,
              // biome-ignore lint/suspicious/noExplicitAny: accessing internal _basePath property
              ((app as any)._basePath || '').replaceAll(/:([^/]+)/g, '{$1}'),
              // biome-ignore lint/suspicious/noExplicitAny: registry definition type is loosely typed
              (def as any).webhook.path,
            ),
          });
          break;
        case 'schema': {
          // biome-ignore lint/suspicious/noExplicitAny: OpenAPI metadata internal types
          const meta = getOpenApiMetadata((def as any).schema);
          // biome-ignore lint/suspicious/noExplicitAny: OpenAPI metadata internal types
          this.openAPIRegistry.register((meta as any)?._internal?.refId, (def as any).schema);
          break;
        }
        case 'parameter': {
          // biome-ignore lint/suspicious/noExplicitAny: OpenAPI metadata internal types
          const meta = getOpenApiMetadata((def as any).schema);
          this.openAPIRegistry.registerParameter(
            // biome-ignore lint/suspicious/noExplicitAny: OpenAPI metadata internal types
            (meta as any)?._internal?.refId,
            // biome-ignore lint/suspicious/noExplicitAny: registry definition type is loosely typed
            (def as any).schema,
          );
          break;
        }
        default: {
          const exhaustive: never = def as never;
          throw new Error(`Unknown registry type: ${exhaustive}`);
        }
      }
    }

    return this;
  }

  /**
   * Override basePath to return an OpenAPIHono with preserved registry state.
   */
  basePath<SubPath extends string>(path: SubPath) {
    return new OpenAPIHono({
      // biome-ignore lint/suspicious/noExplicitAny: spreading Hono's basePath result which has complex internal types
      ...(super.basePath(path) as any),
      defaultHook: this.defaultHook,
      // biome-ignore lint/suspicious/noExplicitAny: return type must match Hono's basePath signature
    }) as any;
  }
}
