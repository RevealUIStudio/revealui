/**
 * Native OpenAPI implementation — zero external dependencies.
 *
 * Replaces @asteasolutions/zod-to-openapi with native Zod → OpenAPI conversion.
 * Status: Phase A — Zod extension, registry, and schema converter implemented.
 * The document generator (Phase B) will complete the replacement.
 */

export {
  type ComponentDefinition,
  NativeOpenAPIRegistry,
  type ParameterDefinition,
  type RegistryDefinition,
  type RouteDefinition,
  type SchemaDefinition,
  type WebhookDefinition,
} from './registry.js';
export {
  extendZodWithOpenApi,
  getOpenApiMetadata,
  type OpenAPIMetadata,
  setOpenApiMetadata,
} from './zod-extension.js';
export { type JSONSchema, zodToJsonSchema } from './zod-to-schema.js';
