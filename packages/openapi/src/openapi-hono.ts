import type { ZodMediaTypeObject } from '@asteasolutions/zod-to-openapi';
import {
  extendZodWithOpenApi,
  getOpenApiMetadata,
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  OpenApiGeneratorV31,
} from '@asteasolutions/zod-to-openapi';
import type { Context, Env, Handler, Input, MiddlewareHandler, Schema, ToSchema } from 'hono';
import { Hono } from 'hono';
import type { MergePath } from 'hono/types';
import { mergePath } from 'hono/utils/url';
import type { OpenAPIObject } from 'openapi3-ts/oas30';
import type { OpenAPIObject as OpenAPIObject31 } from 'openapi3-ts/oas31';
import { z } from 'zod';

import { addBasePathToDocument } from './helpers.js';
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

/**
 * Discriminated union for `OpenAPIRegistry.definitions` entries.
 * The library exports `OpenAPIDefinitions` but its member types are not
 * individually exported, so we mirror the shapes here for safe narrowing.
 */
type RegistryComponentDef = {
  type: 'component';
  componentType: string;
  name: string;
  component: unknown;
};
type RegistryRouteDef = { type: 'route'; route: { path: string; [k: string]: unknown } };
type RegistryWebhookDef = { type: 'webhook'; webhook: { path: string; [k: string]: unknown } };
type RegistrySchemaDef = { type: 'schema'; schema: z.ZodType };
type RegistryParameterDef = { type: 'parameter'; schema: z.ZodType };
type RegistryDef =
  | RegistryComponentDef
  | RegistryRouteDef
  | RegistryWebhookDef
  | RegistrySchemaDef
  | RegistryParameterDef;

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
  ): OpenAPIObject => {
    const document = new OpenApiGeneratorV3(
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
  ): OpenAPIObject31 => {
    const document = new OpenApiGeneratorV31(
      this.openAPIRegistry.definitions,
      generatorConfig,
    ).generateDocument(objectConfig);
    const basePath = getBasePath(this as unknown as Hono);
    return basePath
      ? (addBasePathToDocument(
          document as unknown as OpenAPIObject,
          basePath,
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

    for (const rawDef of app.openAPIRegistry.definitions) {
      // Cast once per iteration: the library's OpenAPIDefinitions type does not
      // expose individual member shapes, so we narrow via our local union.
      const def = rawDef as RegistryDef;
      switch (def.type) {
        case 'component':
          this.openAPIRegistry.registerComponent(
            // biome-ignore lint/suspicious/noExplicitAny: registerComponent's first param is a generic keyof ComponentsObject — our string type is correct at runtime but the generic signature requires the exact literal
            def.componentType as any,
            def.name,
            // biome-ignore lint/suspicious/noExplicitAny: registerComponent's third param is a mapped generic — our unknown is correct at runtime
            def.component as any,
          );
          break;
        case 'route':
          this.openAPIRegistry.registerPath({
            // biome-ignore lint/suspicious/noExplicitAny: registerPath expects RouteConfig which has a complex shape; spread preserves all fields
            ...(def.route as any),
            path: mergePath(pathForOpenAPI, appBasePath, def.route.path),
          });
          break;
        case 'webhook':
          this.openAPIRegistry.registerWebhook({
            // biome-ignore lint/suspicious/noExplicitAny: registerWebhook expects RouteConfig; spread preserves all fields
            ...(def.webhook as any),
            path: mergePath(pathForOpenAPI, appBasePath, def.webhook.path),
          });
          break;
        case 'schema': {
          const meta = getOpenApiMetadata(def.schema) as { _internal?: { refId?: string } };
          const refId = meta?._internal?.refId ?? '';
          this.openAPIRegistry.register(refId, def.schema);
          break;
        }
        case 'parameter': {
          const meta = getOpenApiMetadata(def.schema) as { _internal?: { refId?: string } };
          const paramRefId = meta?._internal?.refId ?? '';
          this.openAPIRegistry.registerParameter(paramRefId, def.schema);
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
