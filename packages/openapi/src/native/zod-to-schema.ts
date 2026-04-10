/**
 * Native Zod → JSON Schema Converter
 *
 * Converts Zod schemas to JSON Schema (OpenAPI 3.0 compatible subset).
 * Replaces the schema conversion logic from @asteasolutions/zod-to-openapi.
 *
 * Supports: string, number, integer, boolean, null, array, object, enum,
 * union, literal, optional, nullable, default, describe, and common
 * validation constraints (min, max, email, url, uuid, regex, etc.).
 */

import type { z } from 'zod';
import { getOpenApiMetadata } from './zod-extension.js';

// =============================================================================
// Types
// =============================================================================

export interface JSONSchema {
  type?: string | string[];
  format?: string;
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  const?: unknown;
  items?: JSONSchema;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  additionalProperties?: boolean | JSONSchema;
  oneOf?: JSONSchema[];
  anyOf?: JSONSchema[];
  allOf?: JSONSchema[];
  not?: JSONSchema;
  $ref?: string;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  minProperties?: number;
  maxProperties?: number;
  nullable?: boolean;
  deprecated?: boolean;
  example?: unknown;
  examples?: unknown[];
  [key: string]: unknown;
}

interface ConversionContext {
  /** Track schemas seen to prevent infinite recursion */
  seen: WeakSet<object>;
  /** Named schemas for $ref generation */
  components: Map<string, JSONSchema>;
}

// =============================================================================
// Converter
// =============================================================================

/**
 * Convert a Zod schema to JSON Schema.
 */
export function zodToJsonSchema(schema: z.ZodTypeAny, ctx?: ConversionContext): JSONSchema {
  const context = ctx ?? { seen: new WeakSet(), components: new Map() };

  // Prevent infinite recursion on circular schemas
  if (context.seen.has(schema)) {
    return {};
  }
  context.seen.add(schema);

  // Check for OpenAPI metadata (refId → $ref)
  const metadata = getOpenApiMetadata(schema);
  if (metadata?.refId && ctx) {
    // Register as component and return $ref
    const refSchema = convertType(schema, context);
    context.components.set(metadata.refId, refSchema);
    return { $ref: `#/components/schemas/${metadata.refId}` };
  }

  const result = convertType(schema, context);

  // Apply OpenAPI metadata overrides
  if (metadata) {
    if (metadata.description) result.description = metadata.description;
    if (metadata.example !== undefined) result.example = metadata.example;
    if (metadata.format) result.format = metadata.format;
    if (metadata.title) result.title = metadata.title;
    if (metadata.deprecated) result.deprecated = metadata.deprecated;
    if (metadata.default !== undefined) result.default = metadata.default;
  }

  // Apply Zod description
  if (schema.description && !result.description) {
    result.description = schema.description;
  }

  return result;
}

/**
 * Zod v4 uses `schema._def.type` (e.g., 'string', 'number', 'object')
 * and stores checks in `check._zod.def` with properties like
 * `{ check: 'min_length', minimum: 3 }`.
 */
function convertType(schema: z.ZodTypeAny, ctx: ConversionContext): JSONSchema {
  const def = schema._def as unknown as Record<string, unknown>;
  const type = def.type as string;

  switch (type) {
    case 'string':
      return convertString(def);
    case 'number':
      return convertNumber(def);
    case 'boolean':
      return { type: 'boolean' };
    case 'null':
      return { type: 'null' };
    case 'undefined':
    case 'void':
    case 'any':
    case 'unknown':
      return {};
    case 'never':
      return { not: {} };
    case 'literal':
      return convertLiteral(def);
    case 'enum':
      return convertEnum(def);
    case 'array':
      return convertArray(def, ctx);
    case 'object':
      return convertObject(def, ctx);
    case 'union':
      return convertUnion(def, ctx);
    case 'intersection':
      return convertIntersection(def, ctx);
    case 'tuple':
      return convertTuple(def, ctx);
    case 'record':
      return convertRecord(def, ctx);
    case 'optional':
      return zodToJsonSchema(def.innerType as z.ZodTypeAny, ctx);
    case 'nullable':
      return convertNullable(def, ctx);
    case 'default':
      return convertDefault(def, ctx);
    case 'pipe':
      return zodToJsonSchema(def.in as z.ZodTypeAny, ctx);
    case 'lazy':
      return zodToJsonSchema((def.getter as () => z.ZodTypeAny)(), ctx);
    case 'branded':
      return zodToJsonSchema(def.type as z.ZodTypeAny, ctx);
    case 'catch':
      return zodToJsonSchema(def.innerType as z.ZodTypeAny, ctx);
    case 'readonly':
      return zodToJsonSchema(def.innerType as z.ZodTypeAny, ctx);
    case 'date':
      return { type: 'string', format: 'date-time' };
    case 'bigint':
      return { type: 'integer', format: 'int64' };
    case 'symbol':
      return { type: 'string' };
    case 'nan':
      return { type: 'number' };
    default:
      return {};
  }
}

// =============================================================================
// Type-specific converters
// =============================================================================

/** Extract Zod v4 check def: stored in `check._zod.def` */
function getCheckDef(check: unknown): Record<string, unknown> {
  const c = check as { _zod?: { def?: Record<string, unknown> } };
  return c?._zod?.def ?? {};
}

function convertString(def: Record<string, unknown>): JSONSchema {
  const result: JSONSchema = { type: 'string' };
  const checks = (def.checks as unknown[]) ?? [];

  for (const check of checks) {
    const cd = getCheckDef(check);
    switch (cd.check) {
      case 'min_length':
        result.minLength = cd.minimum as number;
        break;
      case 'max_length':
        result.maxLength = cd.maximum as number;
        break;
      case 'length':
        result.minLength = cd.length as number;
        result.maxLength = cd.length as number;
        break;
      case 'string_format':
        switch (cd.format) {
          case 'email':
            result.format = 'email';
            break;
          case 'url':
          case 'uri':
            result.format = 'uri';
            break;
          case 'uuid':
            result.format = 'uuid';
            break;
          case 'cuid':
            result.format = 'cuid';
            break;
          case 'datetime':
            result.format = 'date-time';
            break;
          case 'date':
            result.format = 'date';
            break;
          case 'time':
            result.format = 'time';
            break;
          case 'ip':
          case 'ipv4':
            result.format = 'ipv4';
            break;
          case 'ipv6':
            result.format = 'ipv6';
            break;
        }
        break;
      case 'pattern':
        result.pattern = String(cd.pattern);
        break;
      case 'starts_with':
        result.pattern = `^${escapeForPattern(String(cd.prefix))}`;
        break;
      case 'ends_with':
        result.pattern = `${escapeForPattern(String(cd.suffix))}$`;
        break;
      case 'includes':
        result.pattern = escapeForPattern(String(cd.includes));
        break;
    }
  }

  return result;
}

function convertNumber(def: Record<string, unknown>): JSONSchema {
  const checks = (def.checks as unknown[]) ?? [];
  let isInt = false;
  const result: JSONSchema = { type: 'number' };

  for (const check of checks) {
    const cd = getCheckDef(check);
    switch (cd.check) {
      case 'greater_than':
        if (cd.inclusive === false) {
          result.exclusiveMinimum = cd.value as number;
        } else {
          result.minimum = cd.value as number;
        }
        break;
      case 'less_than':
        if (cd.inclusive === false) {
          result.exclusiveMaximum = cd.value as number;
        } else {
          result.maximum = cd.value as number;
        }
        break;
      case 'multiple_of':
        result.multipleOf = cd.value as number;
        break;
      case 'number_format':
        if (cd.format === 'safeint') isInt = true;
        break;
    }
  }

  if (isInt) result.type = 'integer';
  return result;
}

function convertLiteral(def: Record<string, unknown>): JSONSchema {
  // Zod v4 stores literal values in `def.values` as an array
  const values = def.values as unknown[];
  if (!values || values.length === 0) return {};
  const value = values[0];
  if (typeof value === 'string') return { type: 'string', const: value };
  if (typeof value === 'number') return { type: 'number', const: value };
  if (typeof value === 'boolean') return { type: 'boolean', const: value };
  if (value === null) return { type: 'null' };
  return { const: value };
}

function convertEnum(def: Record<string, unknown>): JSONSchema {
  // Zod v4 stores enum entries as `{ a: 'a', b: 'b' }`
  const entries = def.entries as Record<string, string>;
  return { type: 'string', enum: Object.values(entries) };
}

function convertArray(def: Record<string, unknown>, ctx: ConversionContext): JSONSchema {
  // Zod v4 uses `def.element` for array item type
  const result: JSONSchema = {
    type: 'array',
    items: zodToJsonSchema(def.element as z.ZodTypeAny, ctx),
  };

  // Check for min/max length in checks
  const checks = (def.checks as unknown[]) ?? [];
  for (const check of checks) {
    const cd = getCheckDef(check);
    if (cd.check === 'min_length') result.minItems = cd.minimum as number;
    if (cd.check === 'max_length') result.maxItems = cd.maximum as number;
  }

  return result;
}

function convertObject(def: Record<string, unknown>, ctx: ConversionContext): JSONSchema {
  const shape = def.shape as Record<string, z.ZodTypeAny>;

  const properties: Record<string, JSONSchema> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape)) {
    properties[key] = zodToJsonSchema(value, ctx);

    if (!isOptional(value)) {
      required.push(key);
    }
  }

  const result: JSONSchema = { type: 'object', properties };
  if (required.length > 0) result.required = required;

  return result;
}

function convertUnion(def: Record<string, unknown>, ctx: ConversionContext): JSONSchema {
  const options = (def.options as z.ZodTypeAny[]) ?? [];
  return {
    oneOf: options.map((opt) => zodToJsonSchema(opt, ctx)),
  };
}

function convertIntersection(def: Record<string, unknown>, ctx: ConversionContext): JSONSchema {
  return {
    allOf: [
      zodToJsonSchema(def.left as z.ZodTypeAny, ctx),
      zodToJsonSchema(def.right as z.ZodTypeAny, ctx),
    ],
  };
}

function convertTuple(def: Record<string, unknown>, ctx: ConversionContext): JSONSchema {
  const items = (def.items as z.ZodTypeAny[]) ?? [];
  return {
    type: 'array',
    items: { oneOf: items.map((item) => zodToJsonSchema(item, ctx)) },
    minItems: items.length,
    maxItems: items.length,
  };
}

function convertRecord(def: Record<string, unknown>, ctx: ConversionContext): JSONSchema {
  return {
    type: 'object',
    additionalProperties: zodToJsonSchema(def.valueType as z.ZodTypeAny, ctx),
  };
}

function convertNullable(def: Record<string, unknown>, ctx: ConversionContext): JSONSchema {
  const inner = zodToJsonSchema(def.innerType as z.ZodTypeAny, ctx);
  return { ...inner, nullable: true };
}

function convertDefault(def: Record<string, unknown>, ctx: ConversionContext): JSONSchema {
  const inner = zodToJsonSchema(def.innerType as z.ZodTypeAny, ctx);
  const defaultValue =
    typeof def.defaultValue === 'function'
      ? (def.defaultValue as () => unknown)()
      : def.defaultValue;
  return { ...inner, default: defaultValue };
}

// =============================================================================
// Helpers
// =============================================================================

function isOptional(schema: z.ZodTypeAny): boolean {
  const def = schema._def as unknown as Record<string, unknown>;
  const type = def.type as string;
  if (type === 'optional') return true;
  if (type === 'default') return true;
  if (type === 'nullable') {
    return isOptional(def.innerType as z.ZodTypeAny);
  }
  return false;
}

// regex-ok: escaping user input for safe inclusion in a JSON Schema pattern
function escapeForPattern(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
