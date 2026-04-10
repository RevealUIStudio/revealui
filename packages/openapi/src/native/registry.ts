/**
 * Native OpenAPI Registry
 *
 * Collects route definitions, schema components, webhooks, and parameters
 * for OpenAPI document generation. Replaces the OpenAPIRegistry from
 * @asteasolutions/zod-to-openapi.
 *
 * Usage:
 *   const registry = new NativeOpenAPIRegistry();
 *   registry.registerPath({ method: 'get', path: '/users', ... });
 *   const doc = generator.generateDocument(registry.definitions, config);
 */

import type { z } from 'zod';

// =============================================================================
// Types
// =============================================================================

export interface RouteDefinition {
  type: 'route';
  route: {
    method: string;
    path: string;
    summary?: string;
    description?: string;
    tags?: string[];
    operationId?: string;
    deprecated?: boolean;
    request?: {
      params?: z.ZodTypeAny;
      query?: z.ZodTypeAny;
      headers?: z.ZodTypeAny;
      cookies?: z.ZodTypeAny;
      body?: {
        content: Record<string, { schema: z.ZodTypeAny }>;
        required?: boolean;
        description?: string;
      };
    };
    responses: Record<
      string,
      {
        description: string;
        content?: Record<string, { schema: z.ZodTypeAny }>;
        headers?: Record<string, { schema: z.ZodTypeAny }>;
      }
    >;
    security?: Array<Record<string, string[]>>;
  };
}

export interface SchemaDefinition {
  type: 'schema';
  schema: z.ZodTypeAny;
  refId: string;
}

export interface ComponentDefinition {
  type: 'component';
  componentType: 'schemas' | 'responses' | 'parameters' | 'headers' | 'securitySchemes';
  name: string;
  component: unknown;
}

export interface WebhookDefinition {
  type: 'webhook';
  webhook: {
    method: string;
    path: string;
    description?: string;
    request?: RouteDefinition['route']['request'];
    responses: RouteDefinition['route']['responses'];
  };
}

export interface ParameterDefinition {
  type: 'parameter';
  refId: string;
  schema: z.ZodTypeAny;
}

export type RegistryDefinition =
  | RouteDefinition
  | SchemaDefinition
  | ComponentDefinition
  | WebhookDefinition
  | ParameterDefinition;

// =============================================================================
// Registry
// =============================================================================

/**
 * Collects OpenAPI definitions for document generation.
 */
export class NativeOpenAPIRegistry {
  definitions: RegistryDefinition[] = [];

  /**
   * Register a route (path + method + request/response schemas).
   */
  registerPath(route: RouteDefinition['route']): void {
    this.definitions.push({ type: 'route', route });
  }

  /**
   * Register a reusable Zod schema as a named component.
   */
  register(refId: string, schema: z.ZodTypeAny): void {
    this.definitions.push({ type: 'schema', schema, refId });
  }

  /**
   * Register a component (schema, response, parameter, header, or security scheme).
   */
  registerComponent(
    componentType: ComponentDefinition['componentType'],
    name: string,
    component: unknown,
  ): void {
    this.definitions.push({ type: 'component', componentType, name, component });
  }

  /**
   * Register a webhook definition.
   */
  registerWebhook(webhook: WebhookDefinition['webhook']): void {
    this.definitions.push({ type: 'webhook', webhook });
  }

  /**
   * Register a parameter schema for reuse via $ref.
   */
  registerParameter(refId: string, schema: z.ZodTypeAny): void {
    this.definitions.push({ type: 'parameter', refId, schema });
  }
}
