/**
 * Native OpenAPI Document Generator
 *
 * Transforms registry definitions (routes, schemas, components, webhooks,
 * parameters) into a complete OpenAPI 3.0 or 3.1 document.
 *
 * Replaces OpenApiGeneratorV3 and OpenApiGeneratorV31 from
 * @asteasolutions/zod-to-openapi.
 */

import type { z } from 'zod';
import type {
  ComponentDefinition,
  ParameterDefinition,
  RegistryDefinition,
  RouteDefinition,
  SchemaDefinition,
  WebhookDefinition,
} from './registry.js';
import { getOpenApiMetadata } from './zod-extension.js';
import { isOptional, type JSONSchema, zodToJsonSchema } from './zod-to-schema.js';

// =============================================================================
// Config Types
// =============================================================================

export interface OpenAPIDocumentConfig {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
    termsOfService?: string;
    contact?: Record<string, unknown>;
    license?: Record<string, unknown>;
  };
  servers?: Array<{
    url: string;
    description?: string;
    variables?: Record<string, unknown>;
  }>;
  security?: Array<Record<string, string[]>>;
  tags?: Array<{
    name: string;
    description?: string;
    externalDocs?: Record<string, unknown>;
  }>;
  externalDocs?: { url: string; description?: string };
}

export type GeneratorOptions = {};

// =============================================================================
// Internal Types
// =============================================================================

interface ParameterObject {
  name: string;
  in: string;
  required?: boolean;
  description?: string;
  deprecated?: boolean;
  example?: unknown;
  schema: JSONSchema;
}

interface MediaTypeObject {
  schema: JSONSchema;
}

interface RequestBodyObject {
  content: Record<string, MediaTypeObject>;
  required?: boolean;
  description?: string;
}

interface ResponseObject {
  description: string;
  content?: Record<string, MediaTypeObject>;
  headers?: Record<string, { schema: JSONSchema; description?: string }>;
}

interface OperationObject {
  summary?: string;
  description?: string;
  tags?: string[];
  operationId?: string;
  deprecated?: boolean;
  parameters?: ParameterObject[];
  requestBody?: RequestBodyObject;
  responses: Record<string, ResponseObject>;
  security?: Array<Record<string, string[]>>;
}

// =============================================================================
// Shared Context
// =============================================================================

interface GenerationContext {
  /** Track circular schemas */
  seen: WeakSet<object>;
  /** Collected component schemas (from refId references) */
  components: Map<string, JSONSchema>;
}

function createContext(): GenerationContext {
  return { seen: new WeakSet(), components: new Map() };
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Extract individual parameters from a Zod object schema.
 * Each property becomes a separate OpenAPI parameter.
 */
function extractParameters(
  schema: z.ZodTypeAny | undefined,
  location: 'path' | 'query' | 'header' | 'cookie',
  ctx: GenerationContext,
): ParameterObject[] {
  if (!schema) return [];

  const def = schema._def as unknown as Record<string, unknown>;
  if ((def.type as string) !== 'object') return [];

  const shape = def.shape as Record<string, z.ZodTypeAny>;
  const params: ParameterObject[] = [];

  for (const [name, fieldSchema] of Object.entries(shape)) {
    const jsonSchema = zodToJsonSchema(fieldSchema, ctx);
    const meta = getOpenApiMetadata(fieldSchema);

    const param: ParameterObject = {
      name: meta?.param?.name ?? name,
      in: meta?.param?.in ?? location,
      schema: jsonSchema,
    };

    // Path params are always required; others depend on optionality
    if (location === 'path') {
      param.required = true;
    } else {
      const required = meta?.param?.required ?? !isOptional(fieldSchema);
      if (required) param.required = true;
    }

    const description = meta?.param?.description ?? meta?.description ?? jsonSchema.description;
    if (description) param.description = description;

    if (meta?.deprecated) param.deprecated = true;
    if (meta?.example !== undefined) param.example = meta.example;

    params.push(param);
  }

  return params;
}

/**
 * Build an OpenAPI requestBody from a route's body definition.
 */
function buildRequestBody(
  body: NonNullable<RouteDefinition['route']['request']>['body'],
  ctx: GenerationContext,
): RequestBodyObject | undefined {
  if (!body) return undefined;

  const content: Record<string, MediaTypeObject> = {};
  for (const [mediaType, { schema }] of Object.entries(body.content)) {
    content[mediaType] = { schema: zodToJsonSchema(schema, ctx) };
  }

  const result: RequestBodyObject = { content };
  if (body.required !== undefined) result.required = body.required;
  if (body.description) result.description = body.description;
  return result;
}

/**
 * Build OpenAPI responses from a route's response definitions.
 */
function buildResponses(
  responses: RouteDefinition['route']['responses'],
  ctx: GenerationContext,
): Record<string, ResponseObject> {
  const result: Record<string, ResponseObject> = {};

  for (const [statusCode, response] of Object.entries(responses)) {
    const responseObj: ResponseObject = { description: response.description };

    if (response.content) {
      const content: Record<string, MediaTypeObject> = {};
      for (const [mediaType, { schema }] of Object.entries(response.content)) {
        content[mediaType] = { schema: zodToJsonSchema(schema, ctx) };
      }
      responseObj.content = content;
    }

    if (response.headers) {
      const headers: Record<string, { schema: JSONSchema; description?: string }> = {};
      for (const [name, { schema }] of Object.entries(response.headers)) {
        headers[name] = { schema: zodToJsonSchema(schema, ctx) };
      }
      responseObj.headers = headers;
    }

    result[statusCode] = responseObj;
  }

  return result;
}

/**
 * Build a full operation object from a route definition.
 */
function buildOperation(route: RouteDefinition['route'], ctx: GenerationContext): OperationObject {
  const operation: OperationObject = {
    responses: buildResponses(route.responses, ctx),
  };

  // Metadata
  if (route.summary) operation.summary = route.summary;
  if (route.description) operation.description = route.description;
  if (route.tags) operation.tags = route.tags;
  if (route.operationId) operation.operationId = route.operationId;
  if (route.deprecated) operation.deprecated = route.deprecated;
  if (route.security) operation.security = route.security;

  // Parameters
  if (route.request) {
    const parameters: ParameterObject[] = [
      ...extractParameters(route.request.params, 'path', ctx),
      ...extractParameters(route.request.query, 'query', ctx),
      ...extractParameters(route.request.headers, 'header', ctx),
      ...extractParameters(route.request.cookies, 'cookie', ctx),
    ];
    if (parameters.length > 0) operation.parameters = parameters;

    // Request body
    const requestBody = buildRequestBody(route.request.body, ctx);
    if (requestBody) operation.requestBody = requestBody;
  }

  return operation;
}

// =============================================================================
// Generators
// =============================================================================

/**
 * OpenAPI 3.0 document generator.
 *
 * Usage:
 *   const generator = new NativeOpenApiGeneratorV3(registry.definitions);
 *   const doc = generator.generateDocument({ openapi: '3.0.0', info: { ... } });
 */
export class NativeOpenApiGeneratorV3 {
  constructor(
    private definitions: RegistryDefinition[],
    _options?: GeneratorOptions,
  ) {}

  generateDocument(config: OpenAPIDocumentConfig): Record<string, unknown> {
    const ctx = createContext();
    const paths: Record<string, Record<string, OperationObject>> = {};
    const components: Record<string, Record<string, unknown>> = {};

    for (const def of this.definitions) {
      switch (def.type) {
        case 'route':
          this.processRoute(paths, def, ctx);
          break;
        case 'schema':
          this.processSchema(components, def, ctx);
          break;
        case 'component':
          this.processComponent(components, def);
          break;
        case 'webhook':
          // OpenAPI 3.0 does not have top-level webhooks
          break;
        case 'parameter':
          this.processParameter(components, def, ctx);
          break;
      }
    }

    // Merge any schemas discovered via refId during conversion
    if (ctx.components.size > 0) {
      if (!components.schemas) components.schemas = {};
      for (const [refId, schema] of ctx.components) {
        components.schemas[refId] = schema;
      }
    }

    const doc: Record<string, unknown> = {
      ...config,
      paths,
    };

    if (Object.keys(components).length > 0) {
      doc.components = components;
    }

    return doc;
  }

  private processRoute(
    paths: Record<string, Record<string, OperationObject>>,
    def: RouteDefinition,
    ctx: GenerationContext,
  ): void {
    const { path, method } = def.route;
    if (!paths[path]) paths[path] = {};
    paths[path][method] = buildOperation(def.route, ctx);
  }

  private processSchema(
    components: Record<string, Record<string, unknown>>,
    def: SchemaDefinition,
    ctx: GenerationContext,
  ): void {
    if (!components.schemas) components.schemas = {};
    components.schemas[def.refId] = zodToJsonSchema(def.schema, ctx);
  }

  private processComponent(
    components: Record<string, Record<string, unknown>>,
    def: ComponentDefinition,
  ): void {
    if (!components[def.componentType]) components[def.componentType] = {};
    (components[def.componentType] as Record<string, unknown>)[def.name] = def.component;
  }

  private processParameter(
    components: Record<string, Record<string, unknown>>,
    def: ParameterDefinition,
    ctx: GenerationContext,
  ): void {
    if (!components.parameters) components.parameters = {};
    const meta = getOpenApiMetadata(def.schema);
    const paramIn = meta?.param?.in ?? 'query';
    components.parameters[def.refId] = {
      name: meta?.param?.name ?? def.refId,
      in: paramIn,
      required: paramIn === 'path' ? true : (meta?.param?.required ?? !isOptional(def.schema)),
      description: meta?.param?.description ?? meta?.description,
      schema: zodToJsonSchema(def.schema, ctx),
    };
  }
}

/**
 * OpenAPI 3.1 document generator.
 *
 * Identical to V3 but also emits top-level `webhooks`.
 *
 * Usage:
 *   const generator = new NativeOpenApiGeneratorV31(registry.definitions);
 *   const doc = generator.generateDocument({ openapi: '3.1.0', info: { ... } });
 */
export class NativeOpenApiGeneratorV31 {
  constructor(
    private definitions: RegistryDefinition[],
    _options?: GeneratorOptions,
  ) {}

  generateDocument(config: OpenAPIDocumentConfig): Record<string, unknown> {
    const ctx = createContext();
    const paths: Record<string, Record<string, OperationObject>> = {};
    const webhooks: Record<string, Record<string, OperationObject>> = {};
    const components: Record<string, Record<string, unknown>> = {};

    for (const def of this.definitions) {
      switch (def.type) {
        case 'route':
          this.processRoute(paths, def, ctx);
          break;
        case 'schema':
          this.processSchema(components, def, ctx);
          break;
        case 'component':
          this.processComponent(components, def);
          break;
        case 'webhook':
          this.processWebhook(webhooks, def, ctx);
          break;
        case 'parameter':
          this.processParameter(components, def, ctx);
          break;
      }
    }

    // Merge any schemas discovered via refId during conversion
    if (ctx.components.size > 0) {
      if (!components.schemas) components.schemas = {};
      for (const [refId, schema] of ctx.components) {
        components.schemas[refId] = schema;
      }
    }

    const doc: Record<string, unknown> = {
      ...config,
      paths,
    };

    if (Object.keys(components).length > 0) {
      doc.components = components;
    }

    if (Object.keys(webhooks).length > 0) {
      doc.webhooks = webhooks;
    }

    return doc;
  }

  private processRoute(
    paths: Record<string, Record<string, OperationObject>>,
    def: RouteDefinition,
    ctx: GenerationContext,
  ): void {
    const { path, method } = def.route;
    if (!paths[path]) paths[path] = {};
    paths[path][method] = buildOperation(def.route, ctx);
  }

  private processSchema(
    components: Record<string, Record<string, unknown>>,
    def: SchemaDefinition,
    ctx: GenerationContext,
  ): void {
    if (!components.schemas) components.schemas = {};
    components.schemas[def.refId] = zodToJsonSchema(def.schema, ctx);
  }

  private processComponent(
    components: Record<string, Record<string, unknown>>,
    def: ComponentDefinition,
  ): void {
    if (!components[def.componentType]) components[def.componentType] = {};
    (components[def.componentType] as Record<string, unknown>)[def.name] = def.component;
  }

  private processWebhook(
    webhooks: Record<string, Record<string, OperationObject>>,
    def: WebhookDefinition,
    ctx: GenerationContext,
  ): void {
    const { path, method } = def.webhook;
    if (!webhooks[path]) webhooks[path] = {};

    const operation: OperationObject = {
      responses: buildResponses(def.webhook.responses, ctx),
    };

    if (def.webhook.description) operation.description = def.webhook.description;

    if (def.webhook.request) {
      const parameters: ParameterObject[] = [
        ...extractParameters(def.webhook.request.params, 'path', ctx),
        ...extractParameters(def.webhook.request.query, 'query', ctx),
        ...extractParameters(def.webhook.request.headers, 'header', ctx),
        ...extractParameters(def.webhook.request.cookies, 'cookie', ctx),
      ];
      if (parameters.length > 0) operation.parameters = parameters;

      const requestBody = buildRequestBody(def.webhook.request.body, ctx);
      if (requestBody) operation.requestBody = requestBody;
    }

    webhooks[path][method] = operation;
  }

  private processParameter(
    components: Record<string, Record<string, unknown>>,
    def: ParameterDefinition,
    ctx: GenerationContext,
  ): void {
    if (!components.parameters) components.parameters = {};
    const meta = getOpenApiMetadata(def.schema);
    const paramIn = meta?.param?.in ?? 'query';
    components.parameters[def.refId] = {
      name: meta?.param?.name ?? def.refId,
      in: paramIn,
      required: paramIn === 'path' ? true : (meta?.param?.required ?? !isOptional(def.schema)),
      description: meta?.param?.description ?? meta?.description,
      schema: zodToJsonSchema(def.schema, ctx),
    };
  }
}
