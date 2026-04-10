import type { Context, Env, Handler, Input, MiddlewareHandler, Schema, ToSchema } from 'hono';
import { Hono } from 'hono';
import type { MergePath } from 'hono/types';
import { mergePath } from 'hono/utils/url';
import { z } from 'zod';

import { addBasePathToDocument } from './helpers.js';
import {
  extendZodWithOpenApi,
  NativeOpenAPIRegistry,
  NativeOpenApiGeneratorV3,
  NativeOpenApiGeneratorV31,
} from './native/index.js';
import { isFormContentType, isJSONContentType, isZod } from './type-guard.js';
import type {
  ConvertPathType,
  HonoInit,
  Hook,
  InputTypeCookie,
  InputTypeForm,
  InputTypeHeader,
  InputTypeJson,
  InputTypeParam,
  InputTypeQuery,
  MaybePromise,
  OpenAPIGeneratorConfigure,
  OpenAPIGeneratorOptions,
  OpenAPIObjectConfig,
  OpenAPIObjectConfigure,
  RouteConfig,
  RouteConfigToTypedResponse,
  RouteMiddlewareParams,
  ZodMediaTypeObject,
} from './types.js';
import { zValidator } from './zod-validator.js';

// ---------------------------------------------------------------------------
// Internal helpers to reduce scattered `as any` casts
// ---------------------------------------------------------------------------

/**
 * Access Hono's internal `_basePath` which is not part of the public API.
 * Hono declares it as `private _basePath: string` (not a JS #private field),
 * so it is accessible at runtime. This helper confines the cast to one place.
 */
function getBasePath(app: Hono): string {
  return (app as unknown as { _basePath?: string })._basePath ?? '';
}

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
  openAPIRegistry: NativeOpenAPIRegistry;
  defaultHook?: HonoInit<E>['defaultHook'];

  constructor(init?: HonoInit<E>) {
    super(init);
    this.openAPIRegistry = new NativeOpenAPIRegistry();
    this.defaultHook = init?.defaultHook;
  }

  /**
   * Register an OpenAPI route with automatic request validation.
   */
  openapi = <
    R extends RouteConfig,
    I extends Input = InputTypeParam<R> &
      InputTypeQuery<R> &
      InputTypeHeader<R> &
      InputTypeCookie<R> &
      InputTypeForm<R> &
      InputTypeJson<R>,
    P extends string = ConvertPathType<R['path']>,
  >(
    { middleware: routeMiddleware, hide, ...route }: R,
    handler: Handler<
      R['middleware'] extends MiddlewareHandler[] | MiddlewareHandler
        ? RouteMiddlewareParams<R>['env'] & E
        : E,
      P,
      I,
      R extends {
        responses: {
          [statusCode: number]: {
            content: {
              [mediaType: string]: ZodMediaTypeObject;
            };
          };
        };
      }
        ? MaybePromise<RouteConfigToTypedResponse<R>>
        : MaybePromise<RouteConfigToTypedResponse<R>> | MaybePromise<Response>
    >,
    hook:
      | Hook<
          I,
          E,
          P,
          R extends {
            responses: {
              [statusCode: number]: {
                content: {
                  [mediaType: string]: ZodMediaTypeObject;
                };
              };
            };
          }
            ? MaybePromise<RouteConfigToTypedResponse<R>> | undefined
            : MaybePromise<RouteConfigToTypedResponse<R>> | MaybePromise<Response> | undefined
        >
      | undefined = this.defaultHook,
  ): OpenAPIHono<
    E,
    S & ToSchema<R['method'], MergePath<BasePath, P>, I, RouteConfigToTypedResponse<R>>,
    BasePath
  > => {
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
  ): Record<string, unknown> => {
    const document = new NativeOpenApiGeneratorV3(
      this.openAPIRegistry.definitions,
      generatorConfig,
    ).generateDocument(objectConfig);
    const basePath = getBasePath(this as unknown as Hono);
    return basePath ? addBasePathToDocument(document, basePath) : document;
  };

  /**
   * Generate an OpenAPI 3.1 document from registered routes.
   */
  getOpenAPI31Document = (
    objectConfig: OpenAPIObjectConfig,
    generatorConfig?: OpenAPIGeneratorOptions,
  ): Record<string, unknown> => {
    const document = new NativeOpenApiGeneratorV31(
      this.openAPIRegistry.definitions,
      generatorConfig,
    ).generateDocument(objectConfig);
    const basePath = getBasePath(this as unknown as Hono);
    return basePath ? addBasePathToDocument(document, basePath) : document;
  };

  /**
   * Serve OpenAPI 3.0 JSON at a given path.
   */
  doc = <P extends string>(
    path: P,
    configureObject: OpenAPIObjectConfigure<E, P>,
    configureGenerator?: OpenAPIGeneratorConfigure<E, P>,
  ) => {
    return this.get(path, (c: Context<E, P>) => {
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
    return this.get(path, (c: Context<E, P>) => {
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
    if (!app) return (super.route as (path: string) => this)(path);

    const pathForOpenAPI = path.replaceAll(/:([^/]+)/g, '{$1}');
    super.route(path, app);

    if (!(app instanceof OpenAPIHono)) return this;

    const appBasePath = getBasePath(app).replaceAll(/:([^/]+)/g, '{$1}');

    for (const def of app.openAPIRegistry.definitions) {
      switch (def.type) {
        case 'component':
          this.openAPIRegistry.registerComponent(def.componentType, def.name, def.component);
          break;
        case 'route':
          this.openAPIRegistry.registerPath({
            ...def.route,
            path: mergePath(pathForOpenAPI, appBasePath, def.route.path),
          });
          break;
        case 'webhook':
          this.openAPIRegistry.registerWebhook({
            ...def.webhook,
            path: mergePath(pathForOpenAPI, appBasePath, def.webhook.path),
          });
          break;
        case 'schema':
          this.openAPIRegistry.register(def.refId, def.schema);
          break;
        case 'parameter':
          this.openAPIRegistry.registerParameter(def.refId, def.schema);
          break;
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
    // super.basePath() returns a new Hono instance with internal state (_basePath, router, etc.).
    // We spread it into a new OpenAPIHono to preserve registry + defaultHook. The spread requires
    // treating the result as a plain object since Hono's return type is generic and non-spreadable.
    return new OpenAPIHono({
      ...(super.basePath(path) as unknown as Record<string, unknown>),
      defaultHook: this.defaultHook,
      // biome-ignore lint/suspicious/noExplicitAny: return type must match Hono's basePath() generic signature: Hono<E, S, MergePath<BasePath, SubPath>>
    }) as any;
  }
}
