/**
 * Native OpenAPI implementation  -  zero external dependencies.
 *
 * Replaces @asteasolutions/zod-to-openapi with native Zod → OpenAPI conversion.
 * Phase A: Zod extension, registry, and schema converter.
 * Phase B: Document generators (V3 + V31).
 */

export {
  type GeneratorOptions,
  NativeOpenApiGeneratorV3,
  NativeOpenApiGeneratorV31,
  type OpenAPIDocumentConfig,
} from './generator.js';
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
export { isOptional, type JSONSchema, zodToJsonSchema } from './zod-to-schema.js';
