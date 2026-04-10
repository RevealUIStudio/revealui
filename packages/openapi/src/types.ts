import type {
  Context,
  Env,
  Handler,
  Hono,
  Input,
  MiddlewareHandler,
  TypedResponse,
  ValidationTargets,
} from 'hono';
import type { H } from 'hono/types';
import type {
  ClientErrorStatusCode,
  InfoStatusCode,
  RedirectStatusCode,
  ServerErrorStatusCode,
  StatusCode,
  SuccessStatusCode,
} from 'hono/utils/http-status';
import type { JSONParsed } from 'hono/utils/types';
import type { ZodError, ZodType, z } from 'zod';
import type { GeneratorOptions, OpenAPIDocumentConfig } from './native/generator.js';

// ---------------------------------------------------------------------------
// Zod-OpenAPI types (replaces @asteasolutions/zod-to-openapi types)
// ---------------------------------------------------------------------------

export interface ZodMediaTypeObject {
  schema: ZodType;
  example?: unknown;
  examples?: Record<string, { value?: unknown }>;
}

export type ZodContentObject = Record<string, ZodMediaTypeObject>;

export interface ZodRequestBody {
  content: ZodContentObject;
  required?: boolean;
  description?: string;
}

// ---------------------------------------------------------------------------
// Route config
// ---------------------------------------------------------------------------

export interface RouteConfig {
  method: string;
  path: string;
  description?: string;
  summary?: string;
  tags?: string[];
  operationId?: string;
  deprecated?: boolean;
  request?: {
    body?: ZodRequestBody;
    params?: ZodType;
    query?: ZodType;
    headers?: ZodType | ZodType[];
    cookies?: ZodType;
  };
  responses: Record<
    string,
    {
      description: string;
      content?: ZodContentObject;
      headers?: Record<string, ZodType | ZodMediaTypeObject>;
    }
  >;
  security?: Array<Record<string, string[]>>;
  externalDocs?: { description?: string; url: string };
  middleware?: H | H[];
  hide?: boolean;
}

export interface RequestTypes {
  body?: ZodRequestBody;
  params?: ZodType;
  query?: ZodType;
  cookies?: ZodType;
  headers?: ZodType | ZodType[];
}

// ---------------------------------------------------------------------------
// Content-type inference
// ---------------------------------------------------------------------------

export type IsJson<T> = T extends string
  ? T extends `application/${infer Start}json${infer _End}`
    ? Start extends '' | `${string}+` | `vnd.${string}+`
      ? 'json'
      : never
    : never
  : never;

export type IsForm<T> = T extends string
  ? T extends
      | `multipart/form-data${infer _Rest}`
      | `application/x-www-form-urlencoded${infer _Rest}`
    ? 'form'
    : never
  : never;

// ---------------------------------------------------------------------------
// Status code helpers
// ---------------------------------------------------------------------------

export interface StatusCodeRangeDefinitions {
  '1XX': InfoStatusCode;
  '2XX': SuccessStatusCode;
  '3XX': RedirectStatusCode;
  '4XX': ClientErrorStatusCode;
  '5XX': ServerErrorStatusCode;
}

export type RouteConfigStatusCode = keyof StatusCodeRangeDefinitions | StatusCode;

export type ExtractStatusCode<T extends RouteConfigStatusCode> =
  T extends keyof StatusCodeRangeDefinitions ? StatusCodeRangeDefinitions[T] : T;

// ---------------------------------------------------------------------------
// Input type inference
// ---------------------------------------------------------------------------

export type MaybePromise<T> = Promise<T> | T;

export type HasUndefined<T> = undefined extends T ? true : false;

type RequestPart<R extends RouteConfig, Part extends string> = Part extends keyof R['request']
  ? R['request'][Part]
  : object;

type InputTypeBase<
  R extends RouteConfig,
  Part extends string,
  Type extends keyof ValidationTargets,
> = R['request'] extends RequestTypes
  ? RequestPart<R, Part> extends ZodType
    ? {
        in: {
          [K in Type]: HasUndefined<ValidationTargets[K]> extends true
            ? { [K2 in keyof z.input<RequestPart<R, Part>>]?: z.input<RequestPart<R, Part>>[K2] }
            : { [K2 in keyof z.input<RequestPart<R, Part>>]: z.input<RequestPart<R, Part>>[K2] };
        };
        out: { [K in Type]: z.output<RequestPart<R, Part>> };
      }
    : object
  : object;

export type InputTypeParam<R extends RouteConfig> = InputTypeBase<R, 'params', 'param'>;
export type InputTypeQuery<R extends RouteConfig> = InputTypeBase<R, 'query', 'query'>;
export type InputTypeHeader<R extends RouteConfig> = InputTypeBase<R, 'headers', 'header'>;
export type InputTypeCookie<R extends RouteConfig> = InputTypeBase<R, 'cookies', 'cookie'>;

export type InputTypeJson<R extends RouteConfig> = R['request'] extends RequestTypes
  ? R['request']['body'] extends ZodRequestBody
    ? R['request']['body']['content'] extends ZodContentObject
      ? IsJson<keyof R['request']['body']['content']> extends never
        ? object
        : R['request']['body']['content'][keyof R['request']['body']['content']] extends Record<
              'schema',
              // biome-ignore lint/suspicious/noExplicitAny: ZodType constraint requires any for proper inference
              ZodType<any>
            >
          ? {
              in: {
                json: z.input<
                  R['request']['body']['content'][keyof R['request']['body']['content']]['schema']
                >;
              };
              out: {
                json: z.output<
                  R['request']['body']['content'][keyof R['request']['body']['content']]['schema']
                >;
              };
            }
          : object
      : object
    : object
  : object;

export type InputTypeForm<R extends RouteConfig> = R['request'] extends RequestTypes
  ? R['request']['body'] extends ZodRequestBody
    ? R['request']['body']['content'] extends ZodContentObject
      ? IsForm<keyof R['request']['body']['content']> extends never
        ? object
        : R['request']['body']['content'][keyof R['request']['body']['content']] extends Record<
              'schema',
              // biome-ignore lint/suspicious/noExplicitAny: ZodType constraint requires any for proper inference
              ZodType<any>
            >
          ? {
              in: {
                form: z.input<
                  R['request']['body']['content'][keyof R['request']['body']['content']]['schema']
                >;
              };
              out: {
                form: z.output<
                  R['request']['body']['content'][keyof R['request']['body']['content']]['schema']
                >;
              };
            }
          : object
      : object
    : object
  : object;

// ---------------------------------------------------------------------------
// Response type inference
// ---------------------------------------------------------------------------

type ExtractContent<T> = T extends { [K in keyof T]: infer A }
  ? A extends Record<'schema', ZodType>
    ? z.infer<A['schema']>
    : never
  : never;

type ReturnJsonOrTextOrResponse<
  ContentType,
  Content,
  Status extends keyof StatusCodeRangeDefinitions | StatusCode,
> = ContentType extends string
  ? ContentType extends `application/${infer Start}json${infer _End}`
    ? Start extends '' | `${string}+` | `vnd.${string}+`
      ? TypedResponse<JSONParsed<Content>, ExtractStatusCode<Status>, 'json'>
      : never
    : ContentType extends `text/plain${infer _Rest}`
      ? TypedResponse<Content, ExtractStatusCode<Status>, 'text'>
      : Response
  : never;

type DefinedStatusCodes<R extends RouteConfig> = keyof R['responses'] & RouteConfigStatusCode;

export type RouteConfigToTypedResponse<R extends RouteConfig> =
  | {
      [Status in DefinedStatusCodes<R>]: R['responses'][Status] extends { content: infer Content }
        ? undefined extends Content
          ? never
          : ReturnJsonOrTextOrResponse<
              keyof R['responses'][Status]['content'],
              ExtractContent<R['responses'][Status]['content']>,
              Status
            >
        : TypedResponse<object, ExtractStatusCode<Status>, string>;
    }[DefinedStatusCodes<R>]
  | ('default' extends keyof R['responses']
      ? R['responses']['default'] extends { content: infer Content }
        ? undefined extends Content
          ? never
          : ReturnJsonOrTextOrResponse<
              keyof Content,
              ExtractContent<Content>,
              Exclude<StatusCode, ExtractStatusCode<DefinedStatusCodes<R>>>
            >
        : TypedResponse<
            object,
            Exclude<StatusCode, ExtractStatusCode<DefinedStatusCodes<R>>>,
            string
          >
      : never);

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export type Hook<T, E extends Env, P extends string, R> = (
  result: { target: keyof ValidationTargets } & (
    | { success: true; data: T }
    | { success: false; error: ZodError }
  ),
  c: Context<E, P>,
) => R;

// ---------------------------------------------------------------------------
// Middleware composition
// ---------------------------------------------------------------------------

export type AsArray<T> = T extends undefined ? [] : T extends unknown[] ? T : [T];

export type DeepSimplify<T> = {
  [KeyType in keyof T]: T[KeyType] extends Record<string, unknown>
    ? DeepSimplify<T[KeyType]>
    : T[KeyType];
} & object;

export type OfHandlerType<T extends MiddlewareHandler> =
  T extends MiddlewareHandler<infer E, infer P, infer I> ? { env: E; path: P; input: I } : never;

// biome-ignore lint/suspicious/noExplicitAny: Hono's middleware type system requires any in constraint positions for proper type inference
export type MiddlewareToHandlerType<M extends MiddlewareHandler<any, any, any>[]> = M extends [
  infer First,
  infer Second,
  ...infer Rest,
]
  ? // biome-ignore lint/suspicious/noExplicitAny: Hono middleware constraint positions require any
    First extends MiddlewareHandler<any, any, any>
    ? // biome-ignore lint/suspicious/noExplicitAny: Hono middleware constraint positions require any
      Second extends MiddlewareHandler<any, any, any>
      ? // biome-ignore lint/suspicious/noExplicitAny: Hono middleware constraint positions require any
        Rest extends MiddlewareHandler<any, any, any>[]
        ? MiddlewareToHandlerType<
            [
              MiddlewareHandler<
                DeepSimplify<OfHandlerType<First>['env'] & OfHandlerType<Second>['env']>,
                OfHandlerType<First>['path'],
                OfHandlerType<First>['input']
              >,
              ...Rest,
            ]
          >
        : never
      : never
    : never
  : M extends [infer Last]
    ? Last
    : MiddlewareHandler<Env>;

export type RouteMiddlewareParams<R extends RouteConfig> = OfHandlerType<
  MiddlewareToHandlerType<AsArray<R['middleware']>>
>;

export type RouteConfigToEnv<R extends RouteConfig> =
  RouteMiddlewareParams<R> extends never ? Env : RouteMiddlewareParams<R>['env'];

// ---------------------------------------------------------------------------
// Path conversion
// ---------------------------------------------------------------------------

export type ConvertPathType<T extends string> =
  T extends `${infer Start}/{${infer Param}}${infer Rest}`
    ? `${Start}/:${Param}${ConvertPathType<Rest>}`
    : T;

export type RoutingPath<P extends string> = P extends `${infer Head}/{${infer Param}}${infer Tail}`
  ? `${Head}/:${Param}${RoutingPath<Tail>}`
  : P;

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export type RouteHandler<
  R extends RouteConfig,
  E extends Env = RouteConfigToEnv<R>,
  I extends Input = InputTypeParam<R> &
    InputTypeQuery<R> &
    InputTypeHeader<R> &
    InputTypeCookie<R> &
    InputTypeForm<R> &
    InputTypeJson<R>,
  P extends string = ConvertPathType<R['path']>,
> = Handler<
  E,
  P,
  I,
  R extends {
    responses: {
      [statusCode: number]: { content: { [mediaType: string]: ZodMediaTypeObject } };
    };
  }
    ? MaybePromise<RouteConfigToTypedResponse<R>>
    : MaybePromise<RouteConfigToTypedResponse<R>> | MaybePromise<Response>
>;

export type RouteHook<
  R extends RouteConfig,
  E extends Env = RouteConfigToEnv<R>,
  I extends Input = InputTypeParam<R> &
    InputTypeQuery<R> &
    InputTypeHeader<R> &
    InputTypeCookie<R> &
    InputTypeForm<R> &
    InputTypeJson<R>,
  P extends string = ConvertPathType<R['path']>,
> = Hook<
  I,
  E,
  P,
  RouteConfigToTypedResponse<R> | Response | Promise<Response> | void | Promise<void>
>;

// ---------------------------------------------------------------------------
// OpenAPI config
// ---------------------------------------------------------------------------

export type OpenAPIObjectConfig = OpenAPIDocumentConfig;

export type OpenAPIObjectConfigure<E extends Env, P extends string> =
  | OpenAPIObjectConfig
  | ((context: Context<E, P>) => OpenAPIObjectConfig);

export type OpenAPIGeneratorOptions = GeneratorOptions;

export type OpenAPIGeneratorConfigure<E extends Env, P extends string> =
  | OpenAPIGeneratorOptions
  | ((context: Context<E, P>) => OpenAPIGeneratorOptions);

// ---------------------------------------------------------------------------
// OpenAPIHono options
// ---------------------------------------------------------------------------

export interface OpenAPIHonoOptions<E extends Env> {
  // biome-ignore lint/suspicious/noExplicitAny: defaultHook must accept any validation result shape
  defaultHook?: Hook<any, E, any, any>;
}

export type HonoInit<E extends Env> = ConstructorParameters<typeof Hono>[0] & OpenAPIHonoOptions<E>;

export type HonoToOpenAPIHono<T> =
  T extends Hono<infer E, infer S, infer B> ? import('./openapi-hono.js').OpenAPIHono<E, S, B> : T;
